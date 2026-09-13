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

**2026-09-12 product decision**: this deliberately scrapes job boards
(Indeed, Naukri by default), which is a departure from this project's
previous stance (see `ARCHITECTURE.md`'s "Job source policy" and
`BRD.md` §7.1) — accepted explicitly as an MVP-stage, pre-revenue tradeoff,
not a permanent architectural direction. It runs locally/self-hosted, not on
shared platform infrastructure, and is scoped to India only.

## Setup (on any machine)

1. Clone this repo (or `git pull` if you already have it).
2. Python 3.10+ is required (JobSpy's own requirement).
3. From this directory:
   ```bash
   pip install -r requirements.txt
   ```
   This installs `python-jobspy` from PyPI — **not** a clone of JobSpy's own
   repository, just the published package.
   **Windows on ARM64**: `python-jobspy` hard-pins `numpy==1.26.3` and a few
   other exact versions that predate official `win_arm64` wheels, and one
   dependency (`tls-client`) bundles a native DLL that's x64-only regardless
   of wheel availability — there's no way to make it work on an ARM64
   Python interpreter (confirmed 2026-09-12). If `python --version` prints
   an ARM64 build, create the venv with an x64 Python instead (e.g. one
   installed via `uv python install 3.12`, or the standard python.org AMD64
   installer) — Windows on ARM64 runs x64 code fine under emulation:
   ```bash
   <path-to-x64-python> -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   .venv\Scripts\python scrape_and_post.py --dry-run
   ```
4. Copy `.env.example` to `.env` in this same directory and fill in:
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

## Running it

```bash
# First run — backfills everything JobSpy returns (no age filter),
# then remembers the run time in .state.json (gitignored, local to this
# directory).
python scrape_and_post.py

# Every run after the first automatically limits to jobs posted in the
# last JOBSPY_HOURS_OLD hours (default 24) — run it again a day later,
# or...

# ...keep it running as a long-lived process: does one run immediately,
# then sleeps 24h and repeats forever. Use this if you want to just leave
# it running on a machine (a spare laptop, a home server, a cheap VPS) as
# a standing job.
python scrape_and_post.py --loop

# Sanity-check before wiring anything up: scrapes + normalizes but never
# POSTs to the backend.
python scrape_and_post.py --dry-run

# If a JobSpy version update ever changes its output column names and jobs
# stop mapping correctly, this dumps the raw columns + one row as JSON so
# you can see what actually came back and adjust the field-mapping helpers
# in scrape_and_post.py (build_location / build_salary / build_skills /
# normalize_row) accordingly.
python scrape_and_post.py --inspect
```

Running it again on a different machine is exactly the same three steps:
clone the repo, `pip install -r requirements.txt`, set up `.env` there
(pointing `BACKEND_INGEST_URL` at wherever the backend runs, and using the
same `INTERNAL_INGEST_TOKEN` value), then run.

## What it does

1. Reads the same target job-title list the rest of the app's discovery
   pipeline uses (`backend/.../providers/seeds/target-job-titles.json`), so
   this stays in sync automatically if that list ever changes.
2. For each title, calls JobSpy scoped to India (`location=India`,
   `country_indeed=India`) across the sites in `JOBSPY_SITES` (default:
   `indeed,naukri` — see "Site selection" below).
3. Normalizes each result into the same shape the backend's other job
   providers use — title, company, location, url, **full description**,
   salary, remote flag, posted date, and (for Naukri, which already returns
   structured skills) a pre-extracted skills list that lets the backend skip
   its own LLM extraction call for those jobs.
4. De-dupes by URL within the run, then POSTs the normalized jobs in batches
   to `POST /api/internal/jobs/ingest`, which runs them through the exact
   same title-filter + dedup + skill-extraction pipeline every other source
   uses (`discoveryService.ts`'s `ingestExternalJobs`) — tagged with
   `source: "jobspy:<site>"`, so they're easy to find, count, or remove later
   the same way the Adzuna cleanup was done.

## Site selection

Defaults to `indeed` only. **Naukri was tried and confirmed blocked**
(2026-09-12): every request comes back `HTTP 406 "recaptcha required"` —
real, active bot-detection, not a transient rate limit. Working around a
CAPTCHA is out of bounds regardless of the broader scraping decision, so
Naukri stays out of the defaults; add it via `JOBSPY_SITES` if you want to
try anyway, but expect 0 results. This also means Naukri's structured
`skills` field (the reason `JobInput.preExtractedSkills` exists) currently
never actually fires — it's still there for if/when Naukri becomes
reachable, or for other sites that return structured skills.

`linkedin` is also **not** in the default list — this project has a standing
extra-caution stance on LinkedIn specifically (see `CLAUDE.md` §7); add it
yourself via `JOBSPY_SITES` if you want it anyway. `glassdoor`, `google`,
`bayt`, and `bdjobs` are also supported by JobSpy but not defaulted on here
(bayt/bdjobs aren't India-relevant; glassdoor/google are reasonable
additions if you want more volume later — untested here).

## Tuning (all optional, set in `.env`)

| Variable | Default | Meaning |
|---|---|---|
| `JOBSPY_SITES` | `indeed,naukri` | Comma-separated JobSpy site names |
| `JOBSPY_RESULTS_PER_SEARCH` | `30` | Results per title per site |
| `JOBSPY_HOURS_OLD` | `24` | Age filter on every run after the first |
| `JOBSPY_SLEEP_SECONDS` | `8` | Pause between per-title scrape calls |

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
- JobSpy's own docs note LinkedIn rate-limits after ~10 pages from one IP,
  and any site can return HTTP 429 under load — this script logs and skips
  a failed title/site rather than crashing the whole run, but if you're
  seeing a lot of failures, add delay (`JOBSPY_SLEEP_SECONDS`) or a proxy
  (JobSpy supports `proxies=[...]`, not currently wired up here — add it to
  `scrape_for_title()` in `scrape_and_post.py` if you need it).
- This intentionally does not run inside the deployed backend or its Cloud
  Run discovery job — it's a separate, local/self-hosted process by design.
