# JobSpy ingest (local job scraper)

Pulls India job postings with [JobSpy](https://github.com/speedyapply/JobSpy)
and posts them into JobMagnate's shared job pool via the backend's internal
ingest route. Runs as its own standalone process — not part of the deployed
backend or discovery Cloud Run job.

## Why this exists

The API-based job sources (Adzuna, Jooble) only return a short, truncated
snippet of each job's description — not usable for the app's core
skill-matching feature. TheirStack does return full descriptions, but its
free tier (200 jobs/month) is too thin for a pre-revenue MVP. JobSpy scrapes
the real posting pages directly, so `description` is complete.

**2026-09-12 product decision**: this deliberately scrapes job boards, which
is a departure from this project's previous stance (see `ARCHITECTURE.md`'s
"Job source policy" and `BRD.md` §7.1) — accepted explicitly as an
MVP-stage, pre-revenue tradeoff, not a permanent architectural direction. It
runs locally/self-hosted, not on shared platform infrastructure, and is
scoped to India only.

## Setup — one command

This script carries its own dependency metadata (the `# /// script` block
at the top of `scrape_and_post.py`, [PEP 723](https://peps.python.org/pep-0723/)),
so [uv](https://docs.astral.sh/uv/) resolves and installs everything it
needs into a throwaway environment on its own — no venv to create, no
`pip install -r requirements.txt` step. Clone this repo (or `git pull` if
you already have it), copy `.env.example` to `.env` in this directory and
fill it in (see below), then:

```bash
uv run scrape_and_post.py --loop
```

That's it — this is the one command referenced everywhere else in this
file. If you don't have `uv`, install it first: see
https://docs.astral.sh/uv/getting-started/installation/ (one line on every
platform, no Python required beforehand — uv manages its own Python
versions too).

**Windows on ARM64 (e.g. a Surface, or any ARM64 laptop) — one caveat:**
`python-jobspy` pulls in `tls-client`, which ships prebuilt native binaries
with no `win_arm64` build — there's no way to make it work on an ARM64
Python interpreter (confirmed 2026-09-12, still true 2026-09-22). Windows
on ARM64 runs x64 code fine under emulation, so the fix is telling `uv`
which interpreter to use — still one command, just a longer one:

```bash
uv run --python cpython-3.12.13-windows-x86_64-none scrape_and_post.py --loop
```

`uv` downloads that x64 Python build automatically the first time (cached
after that) — you don't need it pre-installed. Every other platform
(x64 Windows, Linux, macOS — Intel or Apple Silicon) just uses the plain
one-liner above with no override.

Don't have `uv` and don't want it? The old manual path still works:
```bash
python -m venv .venv && .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python scrape_and_post.py --loop
```
(same ARM64 caveat applies — create the venv with an x64 Python instead).

## `.env` setup

Copy `.env.example` to `.env` in this same directory and fill in:
- `BACKEND_INGEST_URL` — where the backend's `/api/internal/jobs/ingest`
  route is reachable from *this* machine. If the backend runs on the same
  machine: `http://localhost:3001/api/internal/jobs/ingest`. If not,
  point it at wherever the backend actually runs.
- `INTERNAL_INGEST_TOKEN` — must exactly match `INTERNAL_INGEST_TOKEN` in
  `backend/.env` on whichever machine runs the backend. Generate one with:
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
  and put the same value in both places.

**Targeting the Neon staging database directly (no local backend needed):**
this script never talks to Postgres itself — it always goes through the
backend's HTTP ingest route, which then runs jobs through the real
role-filter/dedup/skill-extraction pipeline (`discoveryService.ts`)
before writing to whichever database *that backend instance* is
connected to. So "point this at the Neon staging DB" means pointing
`BACKEND_INGEST_URL` at the already-deployed **staging** backend (which
is already wired to the Neon `staging` branch, `br-muddy-dream-b3x0ok39`
— see `infra/terraform/INFRASTRUCTURE.md`), not adding a Postgres
connection string here:
```
BACKEND_INGEST_URL=https://jobmagnate-backend-staging-w4642vyi6a-as.a.run.app/api/internal/jobs/ingest
```
`INTERNAL_INGEST_TOKEN` must then be the **staging** token (Secret
Manager secret `jobmagnate-staging-internal-ingest-token`, provisioned
2026-09-17 for exactly this purpose), not whatever's in your local
`backend/.env`. Fetch it yourself with:
```bash
gcloud secrets versions access latest --secret=jobmagnate-staging-internal-ingest-token --project=jobmagnet-6a1ab
```
and paste the value into this `.env`'s `INTERNAL_INGEST_TOKEN`.

## Running it

```bash
# First run — backfills everything JobSpy returns (no age filter),
# then remembers the run time in .state.json (gitignored, local to this
# directory).
uv run scrape_and_post.py

# Every run after the first automatically limits to jobs posted in the
# last JOBSPY_HOURS_OLD hours (default 24) — run it again a day later,
# or...

# ...keep it running as a long-lived process: does one run immediately,
# then sleeps 24h and repeats forever. Use this if you want to just leave
# it running on a machine (a spare laptop, a home server, a cheap VPS) as
# a standing job. This is the one command referenced at the top of this
# file.
uv run scrape_and_post.py --loop

# Sanity-check before wiring anything up: scrapes + normalizes but never
# POSTs to the backend.
uv run scrape_and_post.py --dry-run

# If a JobSpy version update ever changes its output column names and jobs
# stop mapping correctly, this dumps the raw columns + one row as JSON so
# you can see what actually came back and adjust the field-mapping helpers
# in scrape_and_post.py (build_location / build_salary / build_skills /
# normalize_row) accordingly.
uv run scrape_and_post.py --inspect
```

Running it again on a different machine is exactly the same: clone the
repo, set up `.env` there (pointing `BACKEND_INGEST_URL` at wherever the
backend runs, and using the same `INTERNAL_INGEST_TOKEN` value), then
`uv run scrape_and_post.py --loop`. Nothing to install ahead of time beyond
`uv` itself.

## What it does

1. Calls JobSpy scoped to India (`location=India`, `country_indeed=India`)
   across the sites in `JOBSPY_SITES` (default: `indeed,linkedin` — see
   "Site selection" below) — **with no search keyword at all** (see "Why no
   keyword search" below).
2. Normalizes each result into the same shape the backend's other job
   providers use — title, company, location, url, **full description**,
   salary, remote flag, posted date.
3. De-dupes by URL within the run, then POSTs the normalized jobs in batches
   to `POST /api/internal/jobs/ingest`, which runs them through the exact
   same role-filter + dedup + skill-extraction pipeline every other source
   uses (`discoveryService.ts`'s `ingestExternalJobs`) — tagged with
   `source: "jobspy:<site>"`, so they're easy to find, count, or remove later
   the same way the Adzuna cleanup was done.

## Why no keyword search

Originally this looped over ~25 exact job titles from
`target-job-titles.json`, searching each one on each site. **Removed
2026-09-22** by product decision: that list is necessarily incomplete — a
real posting titled something the list didn't anticipate ("Backend SDE"
instead of "Backend Engineer", say) was silently never discovered, no
matter how good a match it would have been. Since this scraper already
pulls most of the popular jobs and now covers every site worth covering,
the fix is to stop pre-filtering by keyword at the scrape layer entirely:
call JobSpy with no `search_term` at all, so it returns everything
currently posted, and let the backend's existing `isAcceptedJobRole()`
filter (`discoveryService.ts`, applied to every discovered job regardless
of source) do the actual relevance filtering it was already doing anyway.

Verified live (2026-09-22): both Indeed and LinkedIn handle a missing
keyword cleanly — they just don't apply a title filter, returning whatever
they'd show someone browsing jobs in India with no search terms typed in.
A real sample confirmed heavy variety (mixed with plenty of non-tech roles,
as expected — accountants, teachers, sales — which `isAcceptedJobRole()`
discards downstream same as always).

One consequence: `results_wanted` now needs to be meaningfully larger than
it used to be, since a much smaller fraction of what comes back is
software-engineering-relevant. See "Tuning" below.

## Site selection

**2026-09-22: trimmed to only what's actually confirmed working**, after a
live diagnostic run against every JobSpy-supported site with and without a
keyword. Default is `indeed,linkedin` — nothing else, and this is a real
finding, not caution:

| Site | Result (2026-09-22, live) |
|---|---|
| `indeed` | Works cleanly, with or without a keyword. |
| `linkedin` | Works cleanly, with or without a keyword. Public listings only — no login, no automation; see `CLAUDE.md` §7's 2026-09-21 clarification. |
| `naukri` | `HTTP 406 "recaptcha required"` on every request (confirmed 2026-09-12) — active bot-detection, not a rate limit. Working around a CAPTCHA is out of bounds. |
| `zip_recruiter` | `HTTP 403 Forbidden` on every request, keyword or not. Also US/Canada-focused, not India-relevant anyway. |
| `bayt` | `HTTP 403 Forbidden` on every request (`403 Client Error: Forbidden for url: https://www.bayt.com/...`). Also Middle-East-focused, not India-relevant anyway. |
| `bdjobs` | Crashes immediately — `TypeError: BDJobs.__init__() got an unexpected keyword argument 'user_agent'`. A genuine incompatibility between this jobspy release and its own BDJobs scraper, not a network issue at all. Also Bangladesh-focused, not India-relevant anyway. |
| `glassdoor` | 0 results every time — `Glassdoor response status code 400` / `Glassdoor: location not parsed`, tried with country-level ("India"), city-level ("Bengaluru, India"), and city+state formats. Not a keyword issue. |
| `google` | 0 results every time, no error — its HTML-scraping approach isn't finding a results page in what Google currently returns (likely stale against Google's current markup for the jobs vertical). |

All seven non-default sites are still selectable via `JOBSPY_SITES` if a
future JobSpy release fixes one of them — worth a quick `--dry-run` retest
after any `python-jobspy` version bump in `requirements.txt`'s pinned
version (or wherever `uv` resolves it from). The circuit breaker below
means re-adding a still-broken site costs almost nothing even if it hasn't
actually been fixed.

## Circuit breaker — don't retry what's actually blocking us

Every site scrape is wrapped in a retry, but **not every failure gets
retried** — `is_retryable_error()` in `scrape_and_post.py` checks first:

- A response that looks like an active block (`403`, "forbidden",
  "blocked", "recaptcha", "captcha" anywhere in the error) skips straight
  to the next site with **no backoff wait at all**. Waiting and asking
  again a minute later was never going to make Bayt stop returning 403 —
  it's not a transient condition, and the old behavior of backing off
  45s/90s/180s/360s per title on a site that was never going to succeed is
  exactly the wasted-time pattern this exists to fix. Confirmed live: this
  makes a hard-blocked site fail in under 3 seconds instead of ~11 minutes.
- A `TypeError` (a code-level incompatibility, like bdjobs's — not
  something a request-level retry could ever fix) is treated the same way:
  fail immediately, move on.
- Anything else (a network blip, a timeout, a transient 5xx) gets the
  normal exponential backoff (`JOBSPY_MAX_RETRIES` attempts,
  `JOBSPY_RETRY_BACKOFF_SECONDS` base delay, doubling each attempt) before
  being logged and skipped.

This now applies **once per site per run**, not once per (title, site) pair
— removing the keyword loop means there's only ever one scrape call per
site to begin with, which on its own already eliminates most of the
old wasted-retry problem.

## LinkedIn rate-limit handling

JobSpy's own docs note LinkedIn rate-limits after roughly 10 pages from one
IP, and `linkedin_fetch_description=True` (needed for full descriptions)
adds one extra request per job on top of pagination — so LinkedIn burns
through that budget faster than a plain listing scrape. To stay under that
threshold instead of tripping it:

- LinkedIn gets its own, longer pause after its call
  (`JOBSPY_LINKEDIN_SLEEP_SECONDS`, default 35s vs. 8s for everything else).
- LinkedIn's `results_wanted` (`JOBSPY_LINKEDIN_RESULTS_PER_SEARCH`, default
  100 — i.e. ~10 pages) is capped independently of every other site's, right
  at the documented threshold rather than past it.
- The `--loop` flag (see "Running it" above) re-scrapes everything again
  24h later, filtered to `JOBSPY_HOURS_OLD` — so even if one run's 100
  results miss something, the next day's run picks up anything posted
  since, keeping LinkedIn coverage current over time rather than needing
  one run to be exhaustive.
- JobSpy also supports `proxies=[...]` if you're still seeing heavy
  blocking after tuning the above — not wired up here; add it to
  `scrape_one()` in `scrape_and_post.py` if you need it.

## Tuning (all optional, set in `.env`)

| Variable | Default | Meaning |
|---|---|---|
| `JOBSPY_SITES` | `indeed,linkedin` | Comma-separated JobSpy site names |
| `JOBSPY_RESULTS_PER_SEARCH` | `300` | Results per run for non-LinkedIn sites — no longer "per title" (see "Why no keyword search"), so this is the whole run's target volume |
| `JOBSPY_LINKEDIN_RESULTS_PER_SEARCH` | `100` | Results per run for LinkedIn specifically (kept at ~10 pages to respect its rate limit) |
| `JOBSPY_HOURS_OLD` | `24` | Age filter on every run after the first |
| `JOBSPY_SLEEP_SECONDS` | `8` | Pause after a non-LinkedIn site's scrape call |
| `JOBSPY_LINKEDIN_SLEEP_SECONDS` | `35` | Pause after LinkedIn's scrape call specifically |
| `JOBSPY_MAX_RETRIES` | `3` | Retry attempts for a *retryable* failure (see "Circuit breaker") before giving up on that site for this run |
| `JOBSPY_RETRY_BACKOFF_SECONDS` | `45` | Base backoff delay for a retryable failure, doubled each attempt |

## Known limitations

- The backend runs a sequential LLM skill-extraction call per genuinely NEW
  job it ingests — a batch of many new jobs can take minutes, not seconds.
  `BATCH_SIZE` (20) and the POST timeout (5 minutes) are tuned around this;
  don't raise `BATCH_SIZE` much without also raising `POST_TIMEOUT_SECONDS`
  in `scrape_and_post.py`, or batches will time out. A failed batch doesn't
  corrupt anything (the backend dedupes by URL) — just re-run the script;
  `last_run_at` is only saved when every batch in a run succeeded, so a
  partially-failed run correctly stays in "first run" mode (no `hours_old`
  filter) until a clean run completes.
- Without a keyword filter, a large fraction of what's scraped is
  non-software-engineering noise that `isAcceptedJobRole()` discards at
  ingestion — this is deliberate (see "Why no keyword search"), but it does
  mean the raw scraped count and the count that actually lands in the pool
  can differ a lot; watch the backend's ingest response (`filteredOut`) if
  that gap looks surprising.
- This intentionally does not run inside the deployed backend or its Cloud
  Run discovery job — it's a separate, local/self-hosted process by design.
