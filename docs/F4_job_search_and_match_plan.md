# F4.5 — Market-wide job discovery, ranking & assisted apply

> **Status (2026-09-06)**
> - **Done:** free aggregator providers **Adzuna**, **Jooble**, and **JSearch**
>   integrated (`backend/src/services/jobs/providers/{adzuna,jooble,jsearch}.ts`),
>   key-gated, wired into `aggregatorProviders` so `POST /api/jobs/discover`
>   picks them up; discover persists provider-supplied `salary` and, for
>   JSearch, a real per-job `isRemote` signal.
>   **JSearch evaluation (real 10-job manual pull, `engineering manager` /
>   India / full-time, via RapidAPI):** approved for live use. 8/10 postings
>   were real, well-formed, full descriptions (2.6–7.2k chars — a genuine
>   strength over Greenhouse, which returns none at all); 1/10 was a
>   source-side templating bug (a Shine.com listing with "reputed company"
>   repeated ~54 times as broken placeholder text — a data-quality artifact of
>   the underlying board, not something JSearch or this app can fix); 1/10 was
>   a domain mismatch (a Marriott facilities/electrical role, from the generic
>   title-only query, not a JSearch defect). No salary data was present in
>   this sample despite the field existing in the schema. Fixing this pull
>   also surfaced and fixed a real, generalizable bug in
>   `jdSkillGap.ts` — JSearch's plain-text (non-HTML) descriptions glue a
>   section heading ("Key Responsibilities", "Technical Skills") onto the end
>   of the previous sentence with no line break, so the line-anchored
>   header/bullet regexes never fired and the whole section was silently
>   skipped; same failure mode a user-pasted JD would hit. Fixed via a
>   `recoverFlattenedStructure()` preprocessing pass — see
>   `jdSkillGap.ts` and its tests. **Known remaining gap:** a JD whose
>   "Required Skills" section is itself split into labeled sub-groups (e.g.
>   "Management & Leadership" / "Technical Expertise" / "System Operations",
>   each with its own bullets) only captures the first sub-group — the
>   sub-heading is structurally indistinguishable from a genuine new section
>   (e.g. a compensation-by-zone table), and closing on the wrong side of that
>   ambiguity risks reintroducing an already-fixed false-positive bug (see
>   the RemoteOK/WeWorkRemotely history above). Left as a documented
>   heuristic limitation rather than risk that regression.
>   Tests: `backend/tests/unit/providers/{adzuna,jooble,jsearch}.test.ts`.
>   Keys documented in `backend/.env.example`.
>   **2026-09-06 update — dual JSearch credentials + interim cron:** the user
>   added a second JSearch key (OpenWeb Ninja's own direct API, in addition to
>   the RapidAPI marketplace key). Since both are the same underlying product/
>   data, `jsearch.ts` now rotates between them via a new
>   `providers/jobCredentialChain.ts` (fallback only, never both for the same
>   search term — querying both would return duplicate jobs and burn both
>   quotas for zero new coverage), benching a credential until the start of
>   next UTC month once it's confirmed exhausted/invalid. Tests:
>   `backend/tests/unit/providers/jobCredentialChain.test.ts`. Also caught
>   live: RapidAPI retired the plain `/search` path (now 404s) in favor of
>   `/search-v2` — fixed in `jsearch.ts`, confirmed against a real key.
>   Separately, a **lightweight interim twice-daily cron** now exists
>   (`services/jobs/discoveryCron.ts`, `node-cron`, off by default —
>   `JOB_DISCOVERY_CRON_ENABLED`) that loops over every user with a
>   `CandidateProfile` and runs the same discover-and-persist logic as the
>   manual button, via a new shared `services/jobs/discoveryService.ts`. This
>   is a deliberately small, no-migration stopgap on the **existing per-user
>   `JobPosting` schema** — it is NOT the Phase 0 global job pool
>   (`JobListing`/`UserJob`) this doc designs below, which still duplicates
>   provider calls per user and doesn't dedupe the same real posting across
>   users. Revisit once Phase 0 lands.
> - **Deferred by the user:** the Firecrawl / crawler tier (Phase 3) — revisit
>   with a cost-first spike. This doc is its saved home.
> - **Not started:** embedding ranking (Phase 4 — deferred as "Tier B" in the
>   matching-redesign memo, see Tier A/B below), assisted-apply (Phase 5).
>   Phase 0 (the global job pool) and a non-embedding version of "surface only
>   what matches" are now **done** — see the next update.
>
> **2026-09-06 update — Phase 0 landed, and discovery + the job board were
> redesigned around it (same day, later):** the interim per-user cron above
> was itself replaced within the same day. Two decisions drove this:
> 1. **Phase 0 (`JobListing`/`UserJob`) is done.** `JobPosting` is gone.
>    `JobListing` is the global, deduped posting (keyed by a hash of its
>    canonical URL — `services/jobs/jobIdentity.ts`); `UserJob` is the
>    per-candidate join (`{userId, jobListingId, origin}`). `MatchResult`,
>    `SkillGapReport`, `GeneratedResumeVersion`, `GeneratedCoverLetter` all
>    point at `UserJob` now, not a per-user job row (see each entity's own
>    comment on why `UserJob`, not `JobListing`, directly). Tests:
>    `backend/tests/unit/{jobIdentity,jobView,discoveryService}.test.ts`.
> 2. **AI skill extraction (the matching-redesign memo's "Tier A")** landed on
>    top of that schema — `services/skills/extractJobSkills.ts` runs once per
>    `JobListing` at ingestion (never per candidate, since the listing is now
>    shared), persisting to `JobListing.skills`/`.normalizedFields`.
>    `matchScore.ts` compares that against the résumé's own AI-extracted
>    skills directly — no more live regex re-extraction per match. The
>    extraction prompt was tightened once already after live testing showed
>    it returning full duty sentences and personality traits as "skills" —
>    see `extractJobSkills.ts`'s header comment for the before/after.
>
> **Then, later the same day — discovery went system-wide and the board went
> automatic:** "The UX should never depend on a person seeing an empty stack
> and has to click discover to find jobs... Do not give the user option to
> call these API. This is an internal feature... a candidate's discovery
> stack should only show the jobs that are already matched with their
> resume, profile and set of skills." Concretely:
> - **`POST /api/jobs/discover` no longer exists.** There is no HTTP route
>   for discovery at all. The twice-daily cron (`discoveryCron.ts`, now
>   defaulting to 7am/5pm IST = `30 1,11 * * *` UTC) is the only caller, and
>   it runs **once per tick against a system-wide target-title list**
>   (`providers/seeds/target-job-titles.json`) rather than once per
>   candidate's profile — see `discoveryService.ts`'s `discoverJobsGlobally()`.
>   That file's list is a committed stand-in for the **admin mode** described
>   in this doc's original Phase 0 sketch (an admin choosing what titles to
>   search for) — not built yet, deliberately deferred by the user ("we will
>   have an admin mode").
> - **`GET /api/jobs` is now the candidate's matched view of the pool, not a
>   log of what they clicked "discover" on.** `services/matching/
>   surfaceJobs.ts`'s `ensureMatchedJobsForCandidate()` scans the pool on
>   every call, scores each listing against the candidate's master résumé
>   (cheap — no LLM call, both sides were AI-extracted once already), and
>   lazily attaches (`UserJob` + persisted `MatchResult`) anything scoring at
>   or above `JOB_MATCH_MIN_SCORE` (default 40/100) that isn't already
>   attached. A candidate with no master résumé yet gets `needsMasterResume:
>   true` and an empty list — never raw, unfiltered jobs. Manually pasted
>   jobs (`POST /api/jobs`) are unaffected — that's still a distinct,
>   deliberate candidate action, always shown regardless of score.
>   Tests: `backend/tests/unit/jobs.routes.test.ts`'s "auto-surfacing matched
>   pool jobs" block.

## Context

**Why:** The app should surface the *best-matching jobs across the whole market* (not
just a handful the user pasted or discovered on demand), keep that list fresh
automatically, and take the candidate straight to applying on the original
posting. Today none of that exists end to end.

**What prompted it:** User wants (a) an AI scraper (Firecrawl-style) pulling jobs
from top job portals, (b) a daily cron so fresh jobs are always available, (c)
"best match out of all jobs available in the market", (d) apply "directly on the
portal where they were posted".

**Intended outcome:** A shared, continuously-refreshed job pool; real
embedding-based cross-market ranking with explanations; and an assisted-apply
flow that respects the human-in-the-loop / no-credential / approval rules the
project already commits to.

---

## Current state — how jobs get listed today (the "what modes" answer)

**(Superseded 2026-09-06 by the update above — kept for history. Two
ingestion paths, both updated since this table was written.)** Code:
`backend/src/routes/jobs.routes.ts`, `backend/src/services/jobs/`.

| Mode | Entry point | Sources | Notes |
|---|---|---|---|
| **Manual paste** | `POST /api/jobs` ("Add job" form) | user-typed | upserts into the shared `JobListing` pool by URL hash; always shown to that candidate regardless of match score |
| **System-wide discovery** | `services/jobs/discoveryCron.ts`, cron only — **no HTTP route** | `remoteBoardProviders` = RemoteOK, WeWorkRemotely, Himalayas (fixed feeds); `atsProviders` = Greenhouse, Lever, Ashby, SmartRecruiters driven by `seeds/india-companies.json`; `aggregatorProviders` = TheirStack, Adzuna, Jooble, JSearch (each key-gated), queried with `providers/seeds/target-job-titles.json`'s system-wide title list, not any one candidate's profile | dedup = URL hash against the whole shared pool (`JobListing`), never per-user; runs once per cron tick, 7am/5pm IST by default |
| **Candidate's job board** | `GET /api/jobs` | reads from the pool `discoverJobsGlobally()` already populated | `services/matching/surfaceJobs.ts` scores the pool against the candidate's résumé on every call and lazily attaches whatever clears `JOB_MATCH_MIN_SCORE`; a candidate with no master résumé sees nothing |

- **Interim cron exists (2026-09-06), full scheduler/queue infra still doesn't.** `discoveryCron.ts` (`node-cron`, in-process, off by default) covers the "keep data fresh automatically" need on the *current* per-user schema. There's still no `bullmq`/`pg-boss`/job queue, and no cron against a global pool — that's Phase 2 below, still blocked on Phase 0.
- **Discover drops data it already has:** the provider `NormalizedJob` shape carries `description`, `salary`, `postedAt`; the discover route persists none of them (`jobs.routes.ts:253-263`). Most ATS/board providers return no `description` at all (only `lever`, `theirstack` do), so discovered rows land with `description: ''`.
- **`JobPosting`** (`backend/src/entities/JobPosting.ts`): no indexes, no unique constraints, columns `normalizedFields` (jsonb) and `skills` (simple-array) exist but are **never populated**. No `postedAt`/`status`/`expiredAt`.
- **Matching** (`backend/src/services/matching/matchScore.ts`): weighted sum — TF-cosine lexical `0.55` + skill-coverage `0.30` + preference-fit `0.15`. **Zero embeddings, zero LLM, no pgvector.** `lexicalSimilarity.ts` and the `matchScore.ts` header both explicitly call the lexical term "the v1 stand-in for a dense semantic embedding model" and note that swapping it "only touches this file's internals". Match is computed per-job on demand (`POST /api/jobs/:id/match` → new `MatchResult` row each call). **No "rank all jobs for this user" surface.**
- **"Apply" today** = an `<a href={job.url} target="_blank">` "Original posting" link on the job detail page. No application entity, no status tracking.
- **Provider framework** (reusable): `backend/src/services/jobs/providers/{types,http,index}.ts` — `Provider { id, detect(entry), fetch(entry, ctx) }`, `ProviderContext { fetchJson, fetchText, sleep }`, SSRF rules = per-provider hostname allowlist + `redirect: 'error'` on every fetch. Adapted from MIT `santifer/career-ops`.

---

## Constraint reconciliation (read before building)

The docs (`CLAUDE.md` §7, `BRD.md` §7.1 / §10 / §11, `ARCHITECTURE.md` "Job source policy") impose hard limits that shape this feature:

1. **Direct scraping of LinkedIn / Indeed / Naukri / Wellfound is a documented hard-no** — "regardless of user consent", not a phasing issue. The user asked to target these anyway. **This plan does not build that.** Instead it reaches those portals' postings *legitimately*:
   - **Licensed aggregator APIs** that re-syndicate Indeed / LinkedIn / Naukri / Wellfound listings — TheirStack is already wired; add **Adzuna** (free key, India + global), **Jooble** (free key), optionally **Careerjet** / **USAJobs**. This is the sanctioned way to get "jobs from all the top portals".
   - **User-pasted JD** stays the path for one specific posting on those sites.
   - **Direct scraping of those four** is written up below as a *gated option*: it requires the project owner to first amend `BRD.md` §7.1 + `CLAUDE.md` §7 and commission a written per-platform ToS/legal review. It is **out of scope for this build** and listed under Open Questions.
2. **Autonomous submission ("apply directly") is Phase-3, behind the `BRD.md` §11 gate** (OAuth-only, per-application human click, written per-platform legal review, security audit, LinkedIn excluded). User chose **assisted apply** — deep-link + approved bundle + status tracking, no credentials, no automation. True auto-apply is documented as a separate future phase, not built.
3. **Cross-market breadth is bounded** to India-first + international-remote-*open-to-India-applicants* (`BRD.md` §6). "Best match across the market" = rank the pool we're allowed to collect, not literally every job on earth.
4. **Process:** `CLAUDE.md` §3/§8 require a `docs/F4_job_search_and_match_plan.md` before F4 code changes, and §9 requires updating `ARCHITECTURE.md` / `PROJECT_STRUCTURE.md`. This plan file should be split into that `docs/` doc at execution time.

---

## Feature definition

### A. Shared global job pool
Scrape/fetch/dedupe **once** into a global table; each user gets a lightweight
per-user reference plus their own match score. Replaces today's N× per-user
job rows.

- **New entity `JobListing`** (`job_listings`) — the global, deduped posting:
  `id`, `source` (provider id), `sourceJobId` (provider's native id when available),
  `url` (canonical, normalized), `urlHash` (unique), `title`, `company`, `companyDomain`,
  `location`, `isRemote`, `country`, `salaryText`, `salaryMin`/`salaryMax`/`salaryCurrency`
  (parsed via existing `parseSalaryRange` in `matchScore.ts`), `description` (text),
  `experienceLevel` (existing `classifyTier`), `skills` (extracted via existing
  `extractJdSkills`), `postedAt`, `firstSeenAt`, `lastSeenAt`, `status`
  (`ACTIVE` | `STALE` | `EXPIRED`), `embedding vector(768)` (pgvector, nullable),
  `raw` (jsonb — provider payload for debuggability).
  Indexes: `unique(urlHash)`, `(status, lastSeenAt)`, `(country, experienceLevel)`,
  ivfflat on `embedding`.
- **New entity `UserJob`** (`user_jobs`) — a user's relationship to a listing:
  `id`, `userId`, `jobListingId`, `origin` (`DISCOVERED` | `PASTED` | `RECOMMENDED`),
  `savedAt`, `dismissedAt`. `unique(userId, jobListingId)`.
- **Migration of existing `JobPosting`:** keep the table for pasted-only jobs OR
  fold into `JobListing` with `source='pasted'` + a `UserJob` row. Recommended:
  one-time migration script folds every existing `JobPosting` into
  `JobListing` + `UserJob`, then `JobPosting` is dropped. `MatchResult`,
  `GeneratedResumeVersion`, `GeneratedCoverLetter`, `SkillGapReport` FKs
  repoint from `jobId → jobListingId` (data migration). This is the largest
  single change — do it first, on its own, with the app briefly in maintenance.

### B. Ingestion — providers + refresh service + cron

- **Keep all existing providers.** Fix the discover route to persist
  `description`, `salary` (parsed), `postedAt` that providers already return.
- **New aggregator providers** under `services/jobs/providers/`: `adzuna.ts`,
  `jooble.ts` (both free-key, degrade to `[]` when unset — same pattern as
  `theirstack.ts`). Each key read through `config` (add `config.jobs.*`;
  today `THEIRSTACK_API_KEY` is read via bare `process.env` — move it into
  `config` per `PROJECT_STRUCTURE.md` "nothing reads process.env directly").
- **New `firecrawl.ts` provider** — generic career-page extractor implementing
  `Provider`. Talks to a `CrawlClient` abstraction (interface: `scrape(url,
  schema) → structured JSON`) so the concrete backend (self-hosted Firecrawl /
  cloud / Playwright+LLM / free alternative) is swappable — see Open Questions.
  - Input: seed entries `{ name, provider: 'firecrawl', careersUrl, extractHint? }`.
  - Hard **host denylist** (`linkedin.com`, `indeed.*`, `naukri.com`,
    `wellfound.com`, `angel.co`) — the provider refuses these even if a seed
    entry points at one. `respectRobotsTxt: true` always.
  - Output: normalized `NormalizedJob[]` (title, url, company, location,
    description, postedAt, salary) — same contract as every other provider.
- **Expand `seeds/india-companies.json`** → split into
  `seeds/companies.json` (all ATS + firecrawl-target companies, ~50-150
  India-hiring + India-open-remote firms) with per-entry `provider`. Add a
  `seeds/boards.json` for crawl-permitted board pages. Keep `verify:seeds`
  working against the new shape.
- **New `services/jobs/refreshJobs.ts`** — the orchestrator used by both cron and a manual endpoint:
  1. Run every provider (ATS from seeds, remote boards, aggregators, firecrawl from seeds), sequentially per host with a small delay (add a per-host throttle in `refreshJobs.ts` or `http.ts` — none exists today).
  2. Normalize + canonicalize URL (strip tracking params, lowercase host) → `urlHash`.
  3. **Upsert into `JobListing`** on `urlHash`: new → insert (`status=ACTIVE`, `firstSeenAt`); seen again → `lastSeenAt = now`, refresh mutable fields.
  4. **Staleness:** listings not seen for `> STALE_DAYS` → `STALE`; not seen for `> EXPIRED_DAYS` (or a `HEAD` check 404/410) → `EXPIRED` (hidden from ranking).
  5. Extract `skills` (`extractJdSkills`), `experienceLevel` (`classifyTier`), parse salary (`parseSalaryRange`).
  6. Enqueue embedding for new/changed listings (Component C).
  7. Write a **`JobRefreshRun`** audit row: `startedAt`, `finishedAt`, `providersRun`, `listingsSeen`, `created`, `updated`, `expired`, `errors` (jsonb `[{source,message}]`).
- **Endpoint `POST /api/jobs/refresh`** — manual trigger (admin / dev), returns the `JobRefreshRun` summary. Reuses `refreshJobs.ts`.
- **Cron:** add `node-cron` (tiny, in-process). Bootstrap in `src/index.ts`
  behind `config.jobs.cronEnabled` (default off in dev, on in prod) +
  `config.jobs.cronSchedule` (default `0 3 * * *` IST-aware). In-process cron
  is fine for a single always-on instance; for horizontal scaling, switch to a
  platform scheduled task hitting `POST /api/jobs/refresh` — noted, not blocking.

### C. Embedding-based cross-market ranking

- **pgvector:** promote from "Phase 2" to now. `CREATE EXTENSION IF NOT EXISTS vector` via a real migration (repo currently has `migrations: []` + `synchronize` in dev — introduce a migrations dir and run migrations in prod; keep `synchronize` for dev only).
- **New `services/ai/embeddings.ts`** — `embed(texts: string[]): Promise<number[][]>` with the same fallback philosophy as `services/ai/providerChain.ts`: **Gemini `text-embedding-004` (free)** → OpenAI `text-embedding-3-small` (paid, behind `LLM_ALLOW_PAID`) → local Ollama `nomic-embed-text`. 768-dim (pad/truncate to a fixed `EMBED_DIM`).
- **Embed:** each `JobListing.description` (title+company+location+description concatenated); each master `GeneratedResumeVersion` (via existing `flattenResumeText`, `services/skills/resumeText.ts`). Re-embed a master resume on approval; re-embed a listing when its description changes. One-time backfill script for existing rows.
- **New `services/matching/rankJobs.ts`** — for a user:
  `hybrid = w_sem * cosine(resumeEmb, jobEmb) + w_skill * skillCoverage + w_pref * preferenceFit`,
  reusing `computeLocationFit`, `computeSalaryFit`, `classifySkillGaps`
  from `matchScore.ts` **unchanged** — only the lexical term is replaced by
  the dense cosine (exactly what the `matchScore.ts` header anticipates).
  Candidate set = `JobListing WHERE status='ACTIVE'` (+ hard prefilters:
  country/remote, seniority band) → pgvector `ORDER BY embedding <=> :resumeEmb
  LIMIT :k` → re-score top-k with the hybrid formula.
- **New endpoints:**
  - `GET /api/jobs/recommended?limit=` — top-N ranked listings across the pool for the caller, each with `{ listing, score, rationale }`. Explanation (`matchedSkills` / `missingSkills` / `locationFit` / `salaryFit`) comes from the reused rule pieces; the prose "why" is generated lazily by the existing `generateJson` match-explanation prompt and cached on `MatchResult`.
  - `GET /api/jobs` — extend to page/filter the pool (country, remote, seniority, source, min-score) and return each with the caller's cached score; add `sort=score|recency`.
  - Keep `POST /api/jobs/:id/match` for the deep single-job view.
- **Frontend:** a **"Recommended"** tab on the jobs board (default landing) driven by `GET /api/jobs/recommended`; dashboard "Top matches" card switches to the same source. Existing filter rail + card component reused.

### D. Assisted-apply flow

- **New enum `ApplicationStatus`** in `entities/enums.ts`: `SAVED`, `READY`
  (materials approved), `APPLIED`, `INTERVIEWING`, `OFFER`, `REJECTED`,
  `WITHDRAWN`.
- **New entity `JobApplication`** (`job_applications`): `id`, `userId`,
  `jobListingId`, `status`, `appliedAt`, `portalUrl` (copied from listing),
  `resumeVersionId` (FK `GeneratedResumeVersion`, must be `APPROVED`),
  `coverLetterId` (FK `GeneratedCoverLetter`, must be `APPROVED`), `notes`
  (text), `nextActionAt`, timeline (jsonb array of `{at, from, to, note}`).
  `unique(userId, jobListingId)`.
- **New routes** (`routes/applications.routes.ts`):
  - `POST /api/jobs/:id/application` — create/attach; 400 if referenced
    résumé/cover letter is not `APPROVED` (reuse the F6 `ArtifactStatus` check
    already used by approvals).
  - `GET /api/applications` — list (kanban data) with filters by status.
  - `PATCH /api/applications/:id` — advance status / edit notes / set
    `nextActionAt`; every change appends to `timeline`.
- **Frontend:**
  - Job detail: an **"Apply on {company}"** panel — shows the approval state of
    the tailored résumé + cover letter; a primary "Open posting & mark applied"
    button that (1) `window.open(listing.url)`, (2) offers copy / PDF download
    of the approved bundle (reuse existing `/tailor/pdf`, `/cover-letter/pdf`),
    (3) on return, a "I submitted this" confirm → `status=APPLIED`.
  - New **`/applications`** page — status board (Saved / Ready / Applied /
    Interviewing / Offer / Closed), per-card next-action date and notes.
    Dashboard gets an "Applications" summary card (counts + next action).
- No credential capture, no auto-fill, no background submission anywhere.

---

## Files to create / change (representative)

**Backend — new**
- `backend/src/entities/JobListing.ts`, `UserJob.ts`, `JobApplication.ts`, `JobRefreshRun.ts`
- `backend/src/services/jobs/providers/{firecrawl,adzuna,jooble}.ts` + `crawlClient.ts` (abstraction)
- `backend/src/services/jobs/refreshJobs.ts`, `backend/src/services/jobs/canonicalUrl.ts`
- `backend/src/services/jobs/scheduler.ts` (node-cron bootstrap)
- `backend/src/services/ai/embeddings.ts`
- `backend/src/services/matching/rankJobs.ts`
- `backend/src/routes/applications.routes.ts`
- `backend/src/scripts/{migrateJobPostings,backfillEmbeddings}.ts`
- `backend/src/migrations/*` (new migrations dir: pgvector extension, new tables, FK repoint)
- `backend/src/services/jobs/providers/seeds/{companies,boards}.json`

**Backend — change**
- `backend/src/routes/jobs.routes.ts` — repoint to `JobListing`/`UserJob`; persist description/salary/postedAt in discover; add `/refresh`, `/recommended`; extend `GET /api/jobs`
- `backend/src/routes/index.ts` — mount `applications.routes`
- `backend/src/config/index.ts` — add `config.jobs` (provider keys, cron flags, `FIRECRAWL_*`, `EMBED_*`, staleness thresholds); move `THEIRSTACK_API_KEY` here
- `backend/src/index.ts` — start the scheduler
- `backend/src/config/dataSource.ts` — register new entities, enable migrations
- `backend/src/services/matching/matchScore.ts` — factor `computeLocationFit`/`computeSalaryFit`/`preferenceFitScore` into a shared export for `rankJobs.ts` (no behaviour change)
- `backend/src/entities/enums.ts` — add `ApplicationStatus`
- `backend/src/entities/{User,MatchResult,GeneratedResumeVersion,GeneratedCoverLetter,SkillGapReport}.ts` — relation updates for `JobListing`
- `backend/package.json` — add `node-cron`, `pgvector` (typeorm helper) or raw SQL; `@types/node-cron`
- `backend/.env.example` — new keys

**Frontend — change**
- `frontend/src/lib/api.ts` — `jobs.recommended()`, `applications.*`, extended `jobs.list` params
- `frontend/src/app/(dashboard)/jobs/page.tsx` — "Recommended" tab, server-side filter/sort
- `frontend/src/app/(dashboard)/jobs/[id]/page.tsx` — assisted-apply panel
- `frontend/src/app/(dashboard)/applications/page.tsx` — **new** status board
- `frontend/src/app/(dashboard)/dashboard/page.tsx` — recommended + applications cards
- `frontend/src/components/layout/Sidebar.tsx` — add "Applications" nav
- `frontend/src/types/index.ts` — `JobListing`, `JobApplication`, `ApplicationStatus`

**Docs (per `CLAUDE.md` §8/§9)**
- `docs/F4_job_search_and_match_plan.md` — **new**, this plan formalized
- `BRD.md` §7.1 — add "robots.txt-respecting extraction of public company career pages" + named legit aggregators as in-scope channels; note the LinkedIn/Indeed/Naukri/Wellfound direct-scrape question as an explicit gated decision
- `ARCHITECTURE.md` — promote pgvector to active; add `jobs` + `scheduler` service modules; add "Scheduled jobs" section; add Firecrawl + aggregators to Job source policy; add `JobListing`/`UserJob`/`JobApplication` to entities & endpoints
- `PROJECT_STRUCTURE.md` — document `services/jobs/`, `services/jobs` scheduler, `migrations/`

---

## Build phases (each independently shippable)

- **Phase 0 — schema refactor:** `JobListing` + `UserJob` + migration of existing `JobPosting` and FKs; introduce migrations dir. No behaviour change beyond storage. Verify existing job/match/tailor/approve flows still pass.
- **Phase 1 — ingestion + manual refresh:** fix discover to keep description/salary/postedAt; `refreshJobs.ts`; `POST /api/jobs/refresh`; `JobRefreshRun`; add Adzuna + Jooble providers; expand seed file; per-host throttle. (No cron, no Firecrawl yet.)
- **Phase 2 — daily cron:** `node-cron` scheduler behind config flag; staleness/expiry; dead-link pruning.
- **Phase 3 — Firecrawl provider:** `crawlClient.ts` abstraction + `firecrawl.ts` + host denylist + seed board/company entries. (Concrete crawl backend chosen in the separate spike — Open Questions.)
- **Phase 4 — embeddings + ranking:** pgvector migration; `embeddings.ts`; `rankJobs.ts`; `GET /api/jobs/recommended`; backfill script; "Recommended" tab + dashboard wiring.
- **Phase 5 — assisted apply:** `JobApplication` + `applications.routes.ts` + apply panel + `/applications` page + dashboard card.

---

## Verification

- **Unit (jest, `backend/tests/unit/`):** `canonicalUrl` normalization/hashing; `refreshJobs` upsert/dedup/staleness with a fake provider set; `firecrawl` provider **rejects denylisted hosts** and honours the normalized shape; `adzuna`/`jooble` degrade to `[]` without keys; `embeddings.ts` fallback order (mock the chain like `anthropicClient.test.ts` does); `rankJobs` hybrid ordering with fixed vectors; `JobApplication` route rejects non-`APPROVED` materials. Keep the existing 254 tests green through the Phase 0 FK repoint.
- **Live (`npm run verify:seeds`, extended):** a `verify:refresh` script that runs `refreshJobs` against the real seed set once and prints `created / updated / expired / errors` — the analogue of today's manual `POST /api/jobs/discover` live check noted in `.claude/skills/verify/SKILL.md`.
- **End-to-end (browser, per the `verify` skill):** register → upload résumé → generate + approve master → `POST /api/jobs/refresh` → open **Recommended** tab, confirm ranked listings with score + matched/missing chips → open a listing → generate + approve tailored résumé & cover letter → **Apply** panel → "Open posting & mark applied" → listing shows on `/applications` as `APPLIED`. Confirm the cron logs a `JobRefreshRun` when `JOBS_CRON_ENABLED=true` and the schedule is set a minute out.
- **Regression:** existing `POST /api/jobs` paste flow, `/match`, `/skill-gap`, `/tailor`, `/cover-letter`, approvals all still work against `JobListing`.

---

## Open questions / follow-up spikes

1. **Crawl backend (own step, cost-first):** decide the concrete engine behind `crawlClient.ts` — self-hosted Firecrawl (Docker), a free self-host alternative (e.g. `crawl4ai`), or Playwright (already shipped for PDF) + Readability + one `generateJson` extraction call. Criteria: $0–low cost, respects robots.txt, maintainable from Node. Phase 3 depends on this.
2. **Direct scraping of LinkedIn / Indeed / Naukri / Wellfound (user asked for it):** blocked by `CLAUDE.md` §7 / `BRD.md` §7.1 as written. To proceed, the project owner must (a) amend those two docs, (b) commission a written per-platform ToS/legal review, (c) accept the platform-policy risk in `BRD.md` §9. Until then, those portals' jobs come via licensed aggregators + paste. Decision needed before any such provider is written.
3. **Embedding model / dim:** confirm Gemini `text-embedding-004` (768-dim, free) as default and OK to promote pgvector now. Fallback to paid only under `LLM_ALLOW_PAID`.
4. **Global pool + privacy:** `JobListing` is shared across users; confirm that's acceptable (it holds only public posting data, no PII). Per-user data stays in `UserJob` / `MatchResult` / `JobApplication`.
5. **Production scheduling:** in-process `node-cron` now; revisit if the backend is ever run multi-instance (switch to a platform scheduled trigger on `POST /api/jobs/refresh`).
6. **Migrations vs `synchronize`:** Phase 0 introduces a migrations dir; confirm prod switches to `migrations` and dev keeps `synchronize`.
