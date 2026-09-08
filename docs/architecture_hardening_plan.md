# Architecture hardening — pre-launch fixes

> **Source:** a side-thread architecture review (pasted into the main session
> 2026-09-07) identified 7 issues beyond the JobPosting→JobListing/UserJob
> migration already shipped. The user set the priority order below; this doc
> tracks execution against it. Each phase closes with green tests + a live
> check before moving to the next — these are infra-level changes, not
> features, so a silent regression here is worse than in most other work.

## Priority order (as given)

**Before MVP launch:**
1. Object storage for uploaded résumés (was flaw #4) — silent data loss on redeploy otherwise.
2. Redis for cache + rate limiting (was flaw #5) — shared LLM-quota exhaustion is live the moment a second real user shows up.
3. Real migrations, retiring bare `synchronize: true` (was flaw #6) — schema changes need a reviewable, rollback-able history.
4. `text[]` fix for skills/target-roles columns (was flaws #1/#2) — cheap now, before more code is written against the string-blob shape.

**Can wait, tracked here so it isn't forgotten:**
5. Postgres advisory lock for the cron + shared credential-bench storage (was flaw #3) — only bites at 2+ backend instances.
6. Soft-delete on audit-relevant entities (was flaw #7) — matters once account deletion is actually exercised against real audit history.
7. Full `Skill` taxonomy / join tables — after Tier A's real extracted data exists to design against (it does now, but this is still the biggest, least-urgent lift here).

## Phase 1 — Object storage (GCS-backed, local-disk fallback)

**Decision:** GCS (the user's call — supersedes the review's S3/R2 suggestion). Credentials are the user's own follow-up ("I will add the configuration for Google Cloud Storage and GCP later") — this phase ships a backend that runs on local disk exactly as today until GCS env vars are set, so nothing here waits on that.

- `services/storage/backends/types.ts` — a small `StorageBackend` interface (`write`/`read`/`delete`), so the storage mechanism is swappable without touching callers.
- `services/storage/backends/localDisk.ts` — today's behavior, `fs/promises`-based (async, since the interface has to accommodate a real network call for the GCS side).
- `services/storage/backends/gcs.ts` — `@google-cloud/storage`-backed. Selected automatically when `GCS_BUCKET_NAME` is set; falls back to local disk otherwise (same "absence never crashes the app" pattern as `SETTINGS_ENCRYPTION_KEY`).
- `services/storage/fileStorage.ts` — becomes a thin async wrapper choosing the backend; the existing app-level encrypt/decrypt (`utils/encryption.ts`) stays untouched and wraps whichever backend is active, so files are encrypted at rest on GCS exactly as they are on disk today — no reliance on GCS's own server-side encryption.
- Callers (`resume.routes.ts`, `account.routes.ts`) get `await` added at each call site — the only behavior-visible change is that these routes are now genuinely async I/O instead of blocking disk calls, which is strictly better.
- New env vars (documented in `.env.example`): `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`, `GCS_KEY_FILE` (path to a service-account JSON key) or `GCS_CREDENTIALS_JSON` (the key inlined — for PaaS targets with no persistent filesystem to put a key file on).

## Phase 2 — Redis (cache + per-user rate limiting)

- `docker-compose.yml` gets a `redis` service (the repo's first, per `ARCHITECTURE.md`'s referenced-but-never-committed compose file — written as part of this phase).
- `services/cache/redisClient.ts` — a single shared client, lazily connected, absence-tolerant (no `REDIS_URL` set → caching/rate-limiting no-op rather than crash, same philosophy as every other optional integration in this codebase).
- **LLM response cache:** key = a content hash of `(feature, resume version id, job listing id)` (or equivalent per-feature inputs) → cached JSON result, short TTL. Applied first to `/match` and `/skill-gap` (already cheap, but the LLM-backed ones — `/tailor`, `/cover-letter`, `/master/generate` — benefit most). Re-scoring the same pair the user just looked at should never spend quota twice.
- **Per-user rate limit:** a sliding-window or fixed-window counter in Redis, applied to the LLM-calling routes (`/tailor`, `/cover-letter`, `/master/generate`, LinkedIn review). Limits are per-user, not global — the goal is stopping one enthusiastic/scripted user from burning the shared free-tier budget for everyone, not throttling the app itself.
- Explicitly **not** wiring the cron lock or credential-bench into Redis yet — that's Phase 5, deferred on purpose. Redis existing after this phase makes Phase 5 a small follow-up rather than new infra, but doing it now would be scope creep on a "before launch" phase.

## Phase 3 — Real TypeORM migrations

- Add a `migrations/` directory and TypeORM's migration runner/generator scripts to `package.json`.
- Generate a **baseline migration** capturing the current schema exactly as `synchronize: true` has already built it (including today's `JobListing`/`UserJob` tables) — this is a snapshot, not a behavior change.
- Flip `synchronize: false` for anything other than `NODE_ENV=test` (tests keep using `synchronize: true` against a throwaway DB — no migration overhead for the suite); wire the migration runner into the dev boot sequence so `npm run dev` still "just works" locally.
- From this point on, **every schema change is a committed migration file**, reviewable and revertible — including Phase 4 below, which is deliberately sequenced to land as the first real migration rather than one more `synchronize` change.

## Phase 4 — `text[]` for skills / target-roles / industries / locations

- `CandidateProfile.targetRoles` / `.industries` / `.locations` and `JobListing.skills`: `simple-array` → `{ type: 'text', array: true }`.
- Written as a real migration (Phase 3 must land first): `USING string_to_array(column, ',')` to convert existing comma-joined values without data loss, plus a GIN index (`USING gin`) on `JobListing.skills` for future containment queries (`@>`).
- No application-code changes needed beyond the entity column type — TypeORM already hands back a real `string[]` either way; the difference is entirely in what Postgres can do with it (indexed containment queries instead of app-level deserialization), which is exactly what the review flagged.
- Skill taxonomy / join tables (`resume_skills`, `job_listing_skills`) stay explicitly deferred (Phase 7) — this phase is the cheap, safe half of the fix, not the full normalization.

## Phase 5 (deferred) — Postgres advisory lock + shared credential-bench table

Only matters once there are 2+ backend instances. When picked up:
- Wrap `discoveryCron.ts`'s scheduled run in `pg_try_advisory_lock` — first instance to acquire it runs that tick, others no-op.
- Move `jobCredentialChain.ts`'s and `providerChain.ts`'s in-memory bench `Map`s into a small shared table (or Redis, now that Phase 2 exists) so instance A learning a credential is exhausted is visible to instance B immediately.

## Phase 6 (deferred) — Soft-delete on audit-relevant entities

`ApprovalRecord` (and anything else whose whole purpose is being a historical record) gets `deletedAt` instead of relying on `onDelete: 'CASCADE'` from `User`. Needs a decision on enforcement: app-level filtering vs. a server-enforced export-before-delete step for account deletion. Revisit when account deletion is actually exercised against real audit history worth preserving.

## Phase 7 (deferred) — Full `Skill` taxonomy

A real `Skill` lookup table + join tables, once Tier A's real extracted output (now live) has been observed at some volume — design the taxonomy against real data, not a guess.

---

## Status

- **Phase 1 (object storage) — done, and now live in real GCP (2026-09-07).**
  `services/storage/backends/{types,localDisk,gcs}.ts` + rewritten `fileStorage.ts`; callers (`resume.routes.ts`, `account.routes.ts`) updated to `await`. `GCS_BUCKET_NAME` unset → identical local-disk behavior to before. Tests: `fileStorage.test.ts`, `gcsBackend.test.ts` (mocked SDK). `.env.example` / `ARCHITECTURE.md` updated.
  - **Configured with real credentials**: bucket `gs://jobmagnet-user-data`, project `jobmagnet-6a1ab`, service-account key at `backend/secrets/jobmagnet-6a1ab-128daa264168.json` (moved there from an unignored spot at the backend root — added `secrets/` to `.gitignore` before anything else, since the key was one `git add .` away from being committed).
  - **Path layout, per the user's request**: `{userId}/{uuid}{extension}` is now baked into the key by `fileStorage.ts` (shared by both backends), with GCS additionally prefixing `resume/` — final real path `resume/{userId}/{uuid}.pdf`. Local disk gets the same per-user subdirectory for free (`uploads/{userId}/...`).
  - **Verified live, full round trip against the real bucket**: uploaded a real file through `POST /api/resumes/upload`, confirmed the object at the correct path via a direct SDK listing, deleted it through `DELETE /api/resumes/:fileId`, confirmed removal.
  - **Found and fixed a real, unrelated pre-existing bug while verifying delete**: `DELETE /api/resumes/:fileId` 500'd (Postgres FK violation, code 23503) on any résumé that had already been parsed — neither `ParsedResume.sourceFileId -> ResumeFile` nor `GeneratedResumeVersion.sourceResumeId -> ParsedResume` has an `onDelete` cascade (the route's own pre-existing code comments already flagged this uncertainty, unresolved until now). Fixed at the application level in `resume.routes.ts` — nulls out `GeneratedResumeVersion.sourceResumeId` (a provenance breadcrumb only; `content` is already a full independent snapshot) before removing the `ParsedResume` row, no migration needed.
- **Phase 2 (Redis) — done.** `docker-compose.yml` (postgres + redis, first commit of the file); `services/cache/{redisClient,llmCache}.ts`; `generate()`/`generateJson()` in `anthropicClient.ts` now cache at their public boundary (per-user-scoped key, not shared across users); `middleware/rateLimit.ts` applied to `/tailor`, `/cover-letter`, `/master/generate`, `/master/:id/regenerate`, `/linkedin/review`. Verified live: identical LinkedIn-review request went 1.9s → 0.35s on the second call, real cache + rate-limit keys confirmed in Redis. Tests: `llmCache.test.ts`, `rateLimit.test.ts`, `gcsBackend.test.ts`-style mocked-SDK pattern reused for `@google-cloud/storage`.
- **Phase 3 (migrations) — done.** `synchronize: false` permanently; baseline migration (`InitialSchema`) generated against an empty DB and marked pre-applied on the real dev DB (whose schema already matched, having been built by `synchronize` up to this point); `AppDataSource.runMigrations()` wired into `index.ts`'s boot sequence (no-ops when nothing's pending, confirmed live). `migration:generate` / `migration:run` / `migration:revert` npm scripts added.
- **Phase 4 (`text[]`) — done.** `CandidateProfile.{targetRoles,industries,locations}` and `JobListing.skills` are native `text[]` now, with a GIN index on `skills`; shipped as a real migration (`TextArrayColumns`) with a hand-written data-preserving `USING string_to_array(...)` conversion (TypeORM's auto-generated version would have silently dropped every existing value — see the migration file's own comment). Verified live: real containment query (`skills @> ARRAY['Python']`) returns correct results against the seeded pool. **One disclosed, unavoidable caveat:** `simple-array`'s unescaped comma-join meant an existing skill value that itself contained a comma (a real one was already in the seeded data: `"data quality, consistency, and integrity"`) got split into multiple array elements by this one-time conversion — inherent to the old format, not fixable after the fact, and doesn't affect anything written from this point on.
- **Found and fixed during Phase 2/4 verification:** the real `.env`'s new `REDIS_URL` was leaking into Jest runs (no test-env isolation existed for it), so the test suite was briefly hitting the actual local Redis and sharing rate-limit counters with live manual `curl` testing — `tests/setupEnv.ts` now force-clears `REDIS_URL` for every test run regardless of the developer's real `.env`.
- **Phases 5-7 — deferred, as scoped above.** Not started.
