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

   **Targeting the Neon staging database directly (no local backend needed):**
   this script never talks to Postgres itself — it always goes through the
   backend's HTTP ingest route, which then runs jobs through the real
   title-filter/dedup/skill-extraction pipeline (`discoveryService.ts`)
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

**2026-09-21 decision: full capability enabled.** Every JobSpy-supported
site is on by default **except Naukri**:
`indeed,linkedin,zip_recruiter,glassdoor,google,bayt,bdjobs`.

- **Naukri stays excluded** — confirmed blocked (2026-09-12): every request
  comes back `HTTP 406 "recaptcha required"`, real active bot-detection,
  not a transient rate limit. Working around a CAPTCHA is out of bounds
  regardless of the broader scraping decision. Add it back via
  `JOBSPY_SITES` if you want to try anyway, but expect 0 results. This also
  means Naukri's structured `skills` field (the reason
  `JobInput.preExtractedSkills` exists) currently never actually fires —
  it's still there for if/when Naukri becomes reachable, or for other sites
  that return structured skills.
- **LinkedIn is now included** — previously excluded under a standing
  extra-caution stance (see `CLAUDE.md` §7). The user explicitly approved
  scraping LinkedIn's public job listings (2026-09-21); this remains
  unauthenticated, credential-free listing scraping only — it is NOT
  LinkedIn automation (no login, no auto-apply, no auto-messaging), which
  `CLAUDE.md` §7 still prohibits. See "LinkedIn rate-limit handling" below
  for how this script keeps LinkedIn scraping running reliably instead of
  just failing on the first 429.
- `zip_recruiter` (US/Canada-focused) and `bayt`/`bdjobs` (Middle East /
  Bangladesh-focused) are also now on by default for full coverage, but
  expect thin-to-zero results from them given this script's India-only
  scope (`COUNTRY = "India"`) — harmless to leave on, a 0-result site just
  logs `0 raw rows`.
- `glassdoor` and `google` are included too (previously listed as
  "untested" additions).

## LinkedIn rate-limit handling

JobSpy's own docs note LinkedIn rate-limits after roughly 10 pages from one
IP, and `linkedin_fetch_description=True` (needed for full descriptions)
adds one extra request per job on top of pagination — so LinkedIn burns
through that budget faster than a plain listing scrape. To keep a run
covering all of LinkedIn's latest matching jobs instead of just skipping it
after the first failure:

- Each site is now scraped **independently per title** (not all sites in
  one JobSpy call), so a LinkedIn-specific failure never drops the other
  sites' results for that title.
- LinkedIn gets its own, longer pause between calls
  (`JOBSPY_LINKEDIN_SLEEP_SECONDS`, default 35s vs. 8s for everything else)
  and a smaller `results_wanted` per search (`JOBSPY_LINKEDIN_RESULTS_PER_SEARCH`,
  default 15) to stay further under the ~10-page threshold.
- Any failed (title, site) call — a 429, a transient network error, anything
  — retries with exponential backoff (`JOBSPY_MAX_RETRIES`, default 4
  attempts; `JOBSPY_RETRY_BACKOFF_SECONDS`, default 45s, doubling each
  attempt: 45s, 90s, 180s, 360s) before being logged and skipped. This
  applies to every site, but matters most for LinkedIn since it's the one
  most likely to actually trip a rate limit.
- The `--loop` flag (see "Running it" above) then re-scrapes everything
  again 24h later, filtered to `JOBSPY_HOURS_OLD` — so even if a handful of
  (title, site) pairs still exhaust their retries in one run, the next
  day's run picks up anything posted since, keeping LinkedIn coverage
  current over time rather than needing one run to be perfect.
- JobSpy also supports `proxies=[...]` if you're still seeing heavy
  blocking after tuning the above — not wired up here; add it to
  `scrape_one()` in `scrape_and_post.py` if you need it.

## Tuning (all optional, set in `.env`)

| Variable | Default | Meaning |
|---|---|---|
| `JOBSPY_SITES` | `indeed,linkedin,zip_recruiter,glassdoor,google,bayt,bdjobs` | Comma-separated JobSpy site names |
| `JOBSPY_RESULTS_PER_SEARCH` | `30` | Results per title per site (non-LinkedIn) |
| `JOBSPY_LINKEDIN_RESULTS_PER_SEARCH` | `15` | Results per title for LinkedIn specifically (kept smaller to respect its rate limit) |
| `JOBSPY_HOURS_OLD` | `24` | Age filter on every run after the first |
| `JOBSPY_SLEEP_SECONDS` | `8` | Pause between per-title/per-site scrape calls (non-LinkedIn) |
| `JOBSPY_LINKEDIN_SLEEP_SECONDS` | `35` | Pause between LinkedIn calls specifically |
| `JOBSPY_MAX_RETRIES` | `4` | Retry attempts for a failed (title, site) call before giving up on it |
| `JOBSPY_RETRY_BACKOFF_SECONDS` | `45` | Base backoff delay, doubled each retry attempt |

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
- Scraping 7 sites × 25 titles per run (instead of 1 site) means each full
  pass takes noticeably longer — budget on the order of an hour or more per
  run given the sleep/retry tuning above, which is fine for a background
  `--loop` process but worth knowing if you're watching it run interactively.
- This intentionally does not run inside the deployed backend or its Cloud
  Run discovery job — it's a separate, local/self-hosted process by design.
