#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "python-jobspy",
#     "python-dotenv",
#     "requests",
# ]
# ///
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

2026-09-22 redesign (see README.md's "Site selection" and "Why no keyword
search" sections for the full story — this is the summary):
- No more per-title keyword looping. A live diagnostic run against every
  JobSpy-supported site (2026-09-22) confirmed indeed/linkedin both scrape
  cleanly with NO search_term at all — this pulls everything currently
  posted rather than only the ~25 exact titles in target-job-titles.json,
  so a real role with different wording than that list no longer gets
  silently missed. The backend's own isAcceptedJobRole() filter (see
  discoveryService.ts) still gates what actually enters the shared pool —
  this script no longer tries to pre-filter by title at all.
- Site defaults trimmed to only what's actually confirmed working:
  zip_recruiter and bayt come back HTTP 403 (blocked) on every request,
  bdjobs crashes on init (TypeError — a genuine version incompatibility in
  this jobspy release, not a network issue), and glassdoor/google both
  return 0 results with real errors ("location not parsed" / no results
  page found) regardless of location or keyword. All five are still
  selectable via JOBSPY_SITES if a future jobspy release fixes them, but
  none are defaulted on any more.
- Retries are now "is this even worth retrying" aware (see
  is_retryable_error() below) instead of always backing off — a 403/
  blocked/CAPTCHA response or a TypeError (a code-level incompatibility,
  not a transient hiccup) fails immediately with no backoff wait at all,
  so one blocked site can't burn minutes of wall-clock time before moving
  on to the next one.

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

Single-command setup: this file carries its own PEP 723 dependency
metadata (the `# /// script` block above), so `uv run scrape_and_post.py`
resolves and installs everything it needs into a throwaway environment on
its own — no venv, no `pip install -r requirements.txt`. See README.md for
the one-liner (and the one Windows-on-ARM64 caveat it can't paper over).
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
STATE_FILE = SCRIPT_DIR / ".state.json"

load_dotenv(SCRIPT_DIR / ".env")

# 2026-09-22: confirmed live against jobspy 1.1.82 — only these two
# actually return real results for an India search. Naukri (406 recaptcha,
# confirmed 2026-09-12), zip_recruiter (403 forbidden), bayt (403
# forbidden), bdjobs (TypeError on init — incompatible with this jobspy
# release's shared `user_agent` kwarg), and glassdoor/google (0 results,
# real errors every time — see README "Site selection" for the exact
# messages) are all excluded from the default. Override via JOBSPY_SITES if
# you want to re-try one (e.g. after a jobspy upgrade) — the retry logic
# below fails fast on a confirmed-blocked site either way, so re-adding a
# still-broken one costs almost nothing.
DEFAULT_SITES = ["indeed", "linkedin"]
COUNTRY = "India"  # per the 2026-09-12 decision: India-only for now

# LinkedIn-specific throttling (JobSpy's own docs + this repo's prior
# experience: LinkedIn rate-limits after roughly 10 pages from one IP, and
# linkedin_fetch_description=True below means one extra request per job on
# top of pagination, so LinkedIn burns through that budget faster than a
# plain listing scrape would). Since this is now ONE call per run (no more
# per-title looping), results_wanted IS the per-run volume — kept at 100
# (~10 pages) to stay right at that threshold instead of tripping it.
DEFAULT_LINKEDIN_SLEEP_SECONDS = 35
DEFAULT_LINKEDIN_RESULTS_PER_SEARCH = 100


def env_list(name: str, default: list) -> list:
    raw = os.environ.get(name, "").strip()
    return [s.strip() for s in raw.split(",") if s.strip()] if raw else default


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw else default


SITES = env_list("JOBSPY_SITES", DEFAULT_SITES)
# No longer "per title" — this is now the whole run's target volume for a
# site, since every title-search is gone. 300 on Indeed (jobs_per_page=100,
# so 3 quick pages) comfortably covers a day's new India postings.
RESULTS_PER_SEARCH = env_int("JOBSPY_RESULTS_PER_SEARCH", 300)
HOURS_OLD = env_int("JOBSPY_HOURS_OLD", 24)
SLEEP_SECONDS = env_int("JOBSPY_SLEEP_SECONDS", 8)
LINKEDIN_SLEEP_SECONDS = env_int("JOBSPY_LINKEDIN_SLEEP_SECONDS", DEFAULT_LINKEDIN_SLEEP_SECONDS)
LINKEDIN_RESULTS_PER_SEARCH = env_int("JOBSPY_LINKEDIN_RESULTS_PER_SEARCH", DEFAULT_LINKEDIN_RESULTS_PER_SEARCH)
# Retries apply per site, per run — see is_retryable_error() below for what
# actually gets retried at all. A transient failure backs off and tries
# again; a confirmed-blocked/incompatible site does not wait around for
# MAX_RETRIES × backoff before giving up on it.
MAX_RETRIES = env_int("JOBSPY_MAX_RETRIES", 3)
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

# 2026-09-22: which failures are worth retrying at all. A site that's
# actively blocking us (403/forbidden/recaptcha/CAPTCHA) or a genuine code
# incompatibility (TypeError — jobspy's own API rejecting a kwarg it used
# to accept, seen live on bdjobs) will not start working on the 2nd or 3rd
# attempt a minute later; waiting and retrying anyway is exactly the
# wasted-time pattern this redesign exists to stop. Matched on the
# exception's own message/type since none of these sites raise a distinct
# exception class for "blocked" — see README "Site selection" for the real
# messages this was tuned against.
_NON_RETRYABLE_MARKERS = ("403", "forbidden", "blocked", "recaptcha", "captcha")


def is_retryable_error(exc: Exception) -> bool:
    if isinstance(exc, TypeError):
        return False
    message = str(exc).lower()
    return not any(marker in message for marker in _NON_RETRYABLE_MARKERS)


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
    these (see JobInput.preExtractedSkills in discoveryService.ts). Naukri
    is excluded from the default site list, but this stays harmless/unused
    dead-simple logic for if/when it (or another structured-skills site)
    becomes reachable again."""
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


def scrape_one(site: str, hours_old: int | None):
    from jobspy import scrape_jobs  # imported lazily so --help works without jobspy installed

    results_wanted = LINKEDIN_RESULTS_PER_SEARCH if site == "linkedin" else RESULTS_PER_SEARCH
    kwargs = dict(
        site_name=[site],
        # No search_term at all (2026-09-22 decision) — pulls everything
        # currently posted for the location rather than only the handful of
        # exact titles target-job-titles.json used to drive. The backend's
        # isAcceptedJobRole() filter (discoveryService.ts) is what actually
        # keeps the shared pool scoped to relevant roles now.
        location=COUNTRY,
        country_indeed=COUNTRY,
        results_wanted=results_wanted,
        linkedin_fetch_description=True,  # only affects the call when site == "linkedin"
    )
    if hours_old is not None:
        kwargs["hours_old"] = hours_old

    df = scrape_jobs(**kwargs)
    return df.to_dict("records") if df is not None and len(df) else []


def scrape_for_site(site: str, hours_old: int | None):
    """One site, one call, for this whole run — no more per-title looping
    (see this file's header for why). Retries with exponential backoff, but
    only when is_retryable_error() says the failure might actually resolve
    on a retry; a confirmed block/incompatibility fails immediately with no
    backoff wait, so one bad site can't burn minutes before the run moves
    on to the next one.
    """
    attempt = 0
    while True:
        try:
            return scrape_one(site, hours_old)
        except Exception as exc:
            if not is_retryable_error(exc):
                print(f"  ! site={site!r} blocked/incompatible, skipping without retry: {exc}", file=sys.stderr)
                return []
            attempt += 1
            if attempt > MAX_RETRIES:
                print(f"  ! giving up on site={site!r} after {MAX_RETRIES} retries: {exc}", file=sys.stderr)
                return []
            backoff = RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1))
            print(
                f"  ! site={site!r} failed (attempt {attempt}/{MAX_RETRIES}): {exc} "
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
          f"(first_run={is_first_run}, hours_old={hours_old}, sites={SITES})")

    all_jobs = []
    for site in SITES:
        rows = scrape_for_site(site, hours_old)

        for row in rows:
            normalized = normalize_row(row, site_hint=site)
            if normalized:
                all_jobs.append(normalized)

        print(f"  - [{site}]: {len(rows)} raw rows")
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
    rows = scrape_for_site(SITES[0], hours_old=None)
    if not rows:
        print("No rows returned — check your jobspy install, or try a different JOBSPY_SITES entry.")
        return
    print("columns:", sorted(rows[0].keys()))
    print("first row:")
    print(json.dumps({k: str(v) for k, v in rows[0].items()}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--loop", action="store_true", help="run forever, sleeping 24h between passes")
    parser.add_argument("--dry-run", action="store_true", help="scrape + normalize only, never POST")
    parser.add_argument("--inspect", action="store_true", help="dump raw jobspy column names for one site and exit")
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
