#!/usr/bin/env python3
"""
Local JobSpy ingest — scrapes India job postings with JobSpy
(https://github.com/speedyapply/JobSpy, installed from PyPI as
`python-jobspy`, never cloned) and posts them straight into JobMagnate's
shared job pool via the backend's internal ingest route
(POST /api/internal/jobs/ingest — see backend/src/routes/internalIngest.routes.ts).

Why this exists: the previously-used aggregator APIs (Adzuna, Jooble) only
return a short truncated snippet of each job description, not the full
text — unusable for the app's core skill-matching feature. TheirStack does
return full descriptions but its free tier (200 jobs/month) is too thin for
a pre-revenue MVP. JobSpy scrapes the original postings directly, so the
description field is the real, complete JD.

2026-09-12 product decision: this deliberately runs OUTSIDE the backend
process, as its own standalone script, and is meant to be run locally (or
on any machine you control) — not deployed as part of the Cloud Run
backend/discovery job. See scripts/jobspy-ingest/README.md for the full
rationale and setup steps, and ARCHITECTURE.md's "Job source policy"
section for how this fits (or deliberately doesn't fit) the platform-ToS
stance that ruled out scraping until this decision.

Usage:
    python scrape_and_post.py            # one scrape+ingest pass, then exit
    python scrape_and_post.py --loop     # first pass immediately, then
                                          # sleep 24h and repeat forever
    python scrape_and_post.py --dry-run  # scrape + normalize, print counts,
                                          # never POSTs anything
    python scrape_and_post.py --inspect  # one tiny scrape, dumps the raw
                                          # column names + first row as JSON
                                          # so you can sanity-check the
                                          # installed jobspy version's output
                                          # shape against FIELD mapping below
"""

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
STATE_FILE = SCRIPT_DIR / ".state.json"
TITLES_FILE = REPO_ROOT / "backend" / "src" / "services" / "jobs" / "providers" / "seeds" / "target-job-titles.json"

load_dotenv(SCRIPT_DIR / ".env")

# naukri deliberately excluded (confirmed live 2026-09-12): every request
# gets HTTP 406 "recaptcha required" from Naukri's own API — this isn't a
# transient block, it's active bot-detection. Working around a CAPTCHA is
# out of bounds regardless of the broader scraping decision, so this stays
# excluded until/unless a legitimate way to query Naukri appears. Add it
# back via JOBSPY_SITES if you want to try anyway, but expect 0 results.
#
# 2026-09-21 decision: every other JobSpy-supported site is now on by
# default, including LinkedIn — see CLAUDE.md §7's 2026-09-21 clarification
# and this directory's README "Site selection" section. bayt/bdjobs and
# zip_recruiter aren't India-focused (Middle East, Bangladesh, US/Canada
# respectively) so expect thin-to-zero results from them for an
# India-scoped search, but they're harmless to leave on — a 0-result site
# just logs "0 raw rows" like Naukri would.
DEFAULT_SITES = ["indeed", "linkedin", "zip_recruiter", "glassdoor", "google", "bayt", "bdjobs"]
COUNTRY = "India"  # per the 2026-09-12 decision: India-only for now

# LinkedIn-specific throttling (JobSpy's own docs + this repo's prior
# experience: LinkedIn rate-limits after roughly 10 pages from one IP, and
# linkedin_fetch_description=True below means one extra request per job on
# top of pagination, so LinkedIn burns through that budget faster than a
# plain listing scrape would). A longer per-title pause and a smaller
# results_wanted specifically for LinkedIn keeps each run under that
# threshold instead of tripping it every time.
DEFAULT_LINKEDIN_SLEEP_SECONDS = 35
DEFAULT_LINKEDIN_RESULTS_PER_SEARCH = 15


def env_list(name: str, default: list) -> list:
    raw = os.environ.get(name, "").strip()
    return [s.strip() for s in raw.split(",") if s.strip()] if raw else default


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw else default


SITES = env_list("JOBSPY_SITES", DEFAULT_SITES)
RESULTS_PER_SEARCH = env_int("JOBSPY_RESULTS_PER_SEARCH", 30)
HOURS_OLD = env_int("JOBSPY_HOURS_OLD", 24)
SLEEP_SECONDS = env_int("JOBSPY_SLEEP_SECONDS", 8)
LINKEDIN_SLEEP_SECONDS = env_int("JOBSPY_LINKEDIN_SLEEP_SECONDS", DEFAULT_LINKEDIN_SLEEP_SECONDS)
LINKEDIN_RESULTS_PER_SEARCH = env_int("JOBSPY_LINKEDIN_RESULTS_PER_SEARCH", DEFAULT_LINKEDIN_RESULTS_PER_SEARCH)
# Retries apply per (title, site) call — a single 429/transient failure no
# longer just gets logged and skipped; it backs off and tries again so a
# rate-limited site still ends up fully scraped by the end of the run
# rather than silently under-covered.
MAX_RETRIES = env_int("JOBSPY_MAX_RETRIES", 4)
RETRY_BACKOFF_SECONDS = env_int("JOBSPY_RETRY_BACKOFF_SECONDS", 45)
BACKEND_INGEST_URL = os.environ.get("BACKEND_INGEST_URL", "").strip()
INTERNAL_INGEST_TOKEN = os.environ.get("INTERNAL_INGEST_TOKEN", "").strip()
# Small on purpose: the backend runs a sequential LLM skill-extraction call
# per genuinely NEW job (upsertJobListing), so a big batch can take minutes,
# not seconds — a 200-job batch timed out entirely on first real use
# (2026-09-12). Small batches keep each request comfortably inside
# POST_TIMEOUT_SECONDS and mean one slow/failed batch only loses a small
# slice of the run, not all of it.
BATCH_SIZE = 20
POST_TIMEOUT_SECONDS = 300


def load_titles() -> list:
    with open(TITLES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)["titles"]


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def is_nan(value) -> bool:
    try:
        return isinstance(value, float) and math.isnan(value)
    except TypeError:
        return False


# Confirmed live (2026-09-12) against jobspy 1.1.82: missing/optional fields
# come back as the literal STRING "None" (or "nan" for a couple of fields),
# not an actual Python None/NaN — e.g. a job with no salary has
# min_amount == "None" (the 4-character string), not None. Both must be
# treated as missing, or downstream code silently misreads a present-but-
# useless string as real data (is_remote == "False" is truthy as a string!).
_MISSING_STRINGS = {"none", "nan", "nat"}


def clean(value):
    """None-ify pandas NaN/NaT, jobspy's stringified "None"/"nan", and empty strings."""
    if value is None or is_nan(value):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "" or stripped.lower() in _MISSING_STRINGS:
            return None
    return value


def first_present(row: dict, *keys):
    """Case-insensitive-ish coalesce across a few plausible column-name variants —
    jobspy's exact column names have shifted across versions; this stays working
    even if one guess is wrong, as long as at least one candidate matches."""
    for key in keys:
        val = clean(row.get(key))
        if val is not None:
            return val
    return None


def to_iso_datetime(value) -> str | None:
    """jobspy's date_posted is typically a date/datetime/pandas Timestamp or an
    ISO-ish string; normalize to a full ISO-8601 datetime string with a Z suffix,
    since the backend's ingest schema (zod .datetime()) requires the full form,
    not a bare date."""
    value = clean(value)
    if value is None:
        return None
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    elif hasattr(value, "isoformat"):
        parsed = value
        if not hasattr(parsed, "hour"):  # a plain date, not a datetime
            parsed = datetime.combine(parsed, datetime.min.time())
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def build_location(row: dict) -> str | None:
    direct = first_present(row, "location", "LOCATION")
    if direct:
        return str(direct)
    parts = [
        first_present(row, "city", "CITY"),
        first_present(row, "state", "STATE"),
        first_present(row, "country", "COUNTRY"),
    ]
    joined = ", ".join(str(p) for p in parts if p)
    return joined or None


def build_salary(row: dict) -> str | None:
    lo = first_present(row, "min_amount", "MIN_AMOUNT")
    hi = first_present(row, "max_amount", "MAX_AMOUNT")
    currency = first_present(row, "currency", "CURRENCY") or "INR"
    interval = first_present(row, "interval", "INTERVAL")
    if lo is None and hi is None:
        return None
    lo = lo if lo is not None else hi
    hi = hi if hi is not None else lo
    suffix = f" per {interval}" if interval else ""
    return f"{lo:,.0f}–{hi:,.0f} {currency}{suffix}"


def build_skills(row: dict) -> list:
    """Naukri's jobspy rows include a structured `skills` field — pass it
    through directly so the backend skips its own LLM extraction call for
    these (see JobInput.preExtractedSkills in discoveryService.ts)."""
    raw = first_present(row, "skills", "SKILLS")
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(s).strip() for s in raw if str(s).strip()]
    if isinstance(raw, str):
        for sep in (",", "|", ";"):
            if sep in raw:
                return [s.strip() for s in raw.split(sep) if s.strip()]
        return [raw.strip()] if raw.strip() else []
    return []


def parse_bool(value) -> bool | None:
    """jobspy returns is_remote as an actual bool in some code paths and as the
    stringified "True"/"False" in others (confirmed live 2026-09-12) — never
    trust Python truthiness on a non-empty string like "False"."""
    value = clean(value)
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() == "true"
    return bool(value)


def normalize_row(row: dict, site_hint: str) -> dict | None:
    url = first_present(row, "job_url_direct", "JOB_URL_DIRECT", "job_url", "JOB_URL")
    title = first_present(row, "title", "TITLE")
    if not url or not title:
        return None

    site = first_present(row, "site", "SITE") or site_hint
    is_remote = parse_bool(first_present(row, "is_remote", "IS_REMOTE"))

    return {
        "title": str(title),
        "company": (str(first_present(row, "company", "COMPANY") or "") or None),
        "location": build_location(row),
        "url": str(url),
        "description": str(first_present(row, "description", "DESCRIPTION") or ""),
        "salary": build_salary(row),
        "isRemote": is_remote,
        "postedAt": to_iso_datetime(first_present(row, "date_posted", "DATE_POSTED")),
        "source": f"jobspy:{site}",
        "preExtractedSkills": build_skills(row) or None,
    }


def scrape_one(title: str, site: str, hours_old: int | None):
    from jobspy import scrape_jobs  # imported lazily so --help works without jobspy installed

    results_wanted = LINKEDIN_RESULTS_PER_SEARCH if site == "linkedin" else RESULTS_PER_SEARCH
    kwargs = dict(
        site_name=[site],
        search_term=title,
        location=COUNTRY,
        country_indeed=COUNTRY,
        results_wanted=results_wanted,
        linkedin_fetch_description=True,  # only affects the call when site == "linkedin"
    )
    if hours_old is not None:
        kwargs["hours_old"] = hours_old

    df = scrape_jobs(**kwargs)
    return df.to_dict("records") if df is not None and len(df) else []


def scrape_for_title(title: str, site: str, hours_old: int | None):
    """One (title, site) pair, scraped one site at a time (rather than
    handing JobSpy the whole SITES list in one call) so a single site's
    rate limit or transient error can't wipe out the other sites' results
    for this title, and so each site gets its own retry/backoff and sleep
    tuning below. Retries with exponential backoff on failure — a 429 from
    LinkedIn (or any site) gets retried rather than immediately counted as
    "0 rows for this title", so a rate-limited run still ends up fully
    scraped rather than silently thin. Only gives up (returns []) after
    JOBSPY_MAX_RETRIES attempts, and logs when that happens so it's visible
    in the run output rather than silently missing jobs.
    """
    attempt = 0
    while True:
        try:
            return scrape_one(title, site, hours_old)
        except Exception as exc:
            attempt += 1
            if attempt > MAX_RETRIES:
                print(
                    f"  ! giving up on title={title!r} site={site!r} after {MAX_RETRIES} retries: {exc}",
                    file=sys.stderr,
                )
                return []
            backoff = RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1))
            print(
                f"  ! title={title!r} site={site!r} failed (attempt {attempt}/{MAX_RETRIES}): {exc} "
                f"— backing off {backoff}s before retrying",
                file=sys.stderr,
            )
            time.sleep(backoff)


def post_batch(jobs: list) -> dict:
    if not BACKEND_INGEST_URL or not INTERNAL_INGEST_TOKEN:
        raise RuntimeError(
            "BACKEND_INGEST_URL and INTERNAL_INGEST_TOKEN must both be set "
            "(copy .env.example to .env in this directory and fill them in)"
        )
    resp = requests.post(
        BACKEND_INGEST_URL,
        json={"jobs": jobs},
        headers={"Authorization": f"Bearer {INTERNAL_INGEST_TOKEN}", "content-type": "application/json"},
        timeout=POST_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return resp.json()


def run_once(dry_run: bool = False) -> None:
    state = load_state()
    is_first_run = "last_run_at" not in state
    hours_old = None if is_first_run else HOURS_OLD

    print(f"[{datetime.now(timezone.utc).isoformat()}] starting run "
          f"(first_run={is_first_run}, hours_old={hours_old}, sites={SITES}, titles={len(load_titles())})")

    all_jobs = []
    titles = load_titles()
    for title in titles:
        for site in SITES:
            rows = scrape_for_title(title, site, hours_old)

            for row in rows:
                normalized = normalize_row(row, site_hint=site)
                if normalized:
                    all_jobs.append(normalized)

            print(f"  - {title!r} [{site}]: {len(rows)} raw rows")
            sleep_seconds = LINKEDIN_SLEEP_SECONDS if site == "linkedin" else SLEEP_SECONDS
            time.sleep(sleep_seconds + random.uniform(0, 2))

    # de-dupe by url within this run before posting — the backend also
    # dedupes, but there's no reason to send the same URL twice
    seen = set()
    deduped = []
    for job in all_jobs:
        if job["url"] in seen:
            continue
        seen.add(job["url"])
        deduped.append(job)

    print(f"scraped {len(all_jobs)} rows total, {len(deduped)} unique URLs")

    if dry_run:
        print("--dry-run: not posting anything. Sample of first 3 normalized jobs:")
        print(json.dumps(deduped[:3], indent=2))
        return

    totals = {"newListings": 0, "seen": 0, "filteredOut": 0}
    batches = [deduped[i : i + BATCH_SIZE] for i in range(0, len(deduped), BATCH_SIZE)]
    failed_batches = 0
    for n, batch in enumerate(batches, start=1):
        try:
            result = post_batch(batch)
            for k in totals:
                totals[k] += result.get(k, 0)
            print(f"  batch {n}/{len(batches)} ({len(batch)} jobs): {result}")
        except requests.RequestException as exc:
            failed_batches += 1
            print(f"  ! batch {n}/{len(batches)} ({len(batch)} jobs) failed: {exc}", file=sys.stderr)

    print(f"ingest totals: {totals} ({failed_batches}/{len(batches)} batches failed)")

    if failed_batches == 0:
        save_state({"last_run_at": datetime.now(timezone.utc).isoformat()})
    else:
        print(
            "NOT updating last_run_at since at least one batch failed — the next run will "
            "still do a full (non-hours_old-filtered) pass rather than risk silently skipping jobs.",
            file=sys.stderr,
        )


def run_inspect() -> None:
    titles = load_titles()
    rows = scrape_for_title(titles[0], SITES[0], hours_old=None)
    if not rows:
        print("No rows returned — try a broader title or check your jobspy install.")
        return
    print("columns:", sorted(rows[0].keys()))
    print("first row:")
    print(json.dumps({k: str(v) for k, v in rows[0].items()}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--loop", action="store_true", help="run forever, sleeping 24h between passes")
    parser.add_argument("--dry-run", action="store_true", help="scrape + normalize only, never POST")
    parser.add_argument("--inspect", action="store_true", help="dump raw jobspy column names for one title and exit")
    args = parser.parse_args()

    if args.inspect:
        run_inspect()
        return

    run_once(dry_run=args.dry_run)
    if not args.loop:
        return

    while True:
        print(f"sleeping 24h until next run (Ctrl+C to stop)...")
        time.sleep(24 * 60 * 60)
        run_once(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
