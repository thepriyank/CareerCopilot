# CI/CD & Terraform Plan — GCP Cloud Run + Neon (2026-09-08)

Status: **planning approved, implementation not started**. This is the plan
CLAUDE.md's "plan before coding" step requires before any `.tf`/workflow
files are written. Decisions below were made explicitly by the user; nothing
here is a silent assumption.

## Decisions made

| Question | Decision |
|---|---|
| Frontend hosting | **GCP Cloud Run** (not Vercel) — same stack as backend, one Terraform story |
| GCP project scope | **Same existing project**, `jobmagnet-6a1ab` (already holds GCS + Firebase). Staging/prod isolated by resource naming + IAM, not project boundary |
| Redis | **Skipped for MVP.** Both the LLM cache and per-user rate limiter fail open when `REDIS_URL` is unset — no crash, no caching, no throttling. Revisit later by pointing `REDIS_URL` at an external managed Redis (e.g. Upstash — free tier, public TLS, no VPC connector needed); GCP Memorystore was considered and rejected on cost (VPC connector + non-free instance, ~$50–70/mo minimum) |
| Environments | **`staging` + `production`** only, to start. Ephemeral per-PR Neon branches (CI-only, ties into `neon.ts`'s existing 7-day TTL policy) are a later stretch phase, not day one |
| Auth to GCP from GitHub Actions | **Workload Identity Federation** (no long-lived service-account JSON key in GitHub Secrets) |
| GCS/Firebase credentials on Cloud Run | **ADC via the Cloud Run service's attached service account** — no `GCS_KEY_FILE`/`GCS_CREDENTIALS_JSON`/`FIREBASE_KEY_FILE`/`FIREBASE_CREDENTIALS_JSON` secret shipped to any deployed environment |

Because Redis is out of scope for MVP, no VPC connector is needed anywhere
in this design — every managed dependency (Neon, GCS, Firebase, the LLM
provider APIs, the job-aggregator APIs) is reached over the public internet
with TLS, which keeps both Cloud Run services on the cheapest "no VPC"
networking path.

## Facts this plan is grounded in

- **Backend**: Express + TypeORM, `synchronize: false` permanently, real
  migrations under `backend/src/migrations/` (`migration:generate` /
  `migration:run` / `migration:revert` via `typeorm-ts-node-commonjs -d
  src/config/dataSource.ts`).
- **Migrations currently run on every app boot** — `backend/src/index.ts`
  calls `AppDataSource.runMigrations()` unconditionally before
  `app.listen()`. This is fine for one local dev process; it's a real race
  the moment two Cloud Run instances overlap during a rolling deploy. See
  Phase E.
- **`discoveryCron.ts`** is an in-process `node-cron` schedule started from
  `index.ts` after `app.listen()`, guarded only by an in-memory `running`
  boolean — not safe across instances, and won't fire at all if the instance
  it would run on has scaled to zero. See Phase E.
- **Redis** (`ioredis`, `REDIS_URL`) backs the LLM response cache and
  per-user rate limiting, both explicitly designed to fail open
  (`docs/architecture_hardening_plan.md` Phase 2, `config/index.ts`'s
  `redis`/`rateLimit` blocks). Leaving `REDIS_URL` unset in Cloud Run is
  exercising an already-built, already-tested code path, not a new one.
- **GCS**: bucket `gs://jobmagnet-user-data`, GCP project `jobmagnet-6a1ab`.
  Credential resolution order: `GCS_KEY_FILE` → `GCS_CREDENTIALS_JSON` →
  Application Default Credentials. Same pattern for Firebase Admin
  (`FIREBASE_KEY_FILE` / `FIREBASE_CREDENTIALS_JSON` / ADC), project
  `jobmagnet-6a1ab` (confirmed — same project as GCS).
- **Full env surface**: `backend/.env.example` (server/CORS, DB, JWT,
  Firebase, 8 LLM provider keys + tuning, settings-encryption key, 5
  job-aggregator keys + cron/matching tuning, upload config, GCS config,
  Redis config) and `frontend/.env.local.example` (`NEXT_PUBLIC_API_URL` +
  4 `NEXT_PUBLIC_FIREBASE_*` values).
- **Neon** already provisioned: project `polished-unit-87797764`, org
  `org-wild-field-89493590`, region `aws-ap-southeast-1`. Root `neon.ts`
  policy: production branch untouched, any new non-default branch auto-TTLs
  at 7 days. Root `package.json` already has `neon`, `@neon/config`,
  `@neon/env` as devDependencies. `.mcp.json` (gitignored) holds a
  *personal* Neon API token for local MCP use only — CI needs its own
  separately-scoped Neon API key, never reuse that one.
- **`docker-compose.yml`** is local-only (Postgres 16 + Redis 7) — not part
  of any deployed environment; kept as-is for local dev.
- **No Dockerfile, no `.github/`, no `*.tf` files exist anywhere in the repo
  today** — this is a from-scratch buildout.
- Confirmed via `git remote -v`: the GitHub repo is `thepriyank/CareerCopilot`
  — the app was renamed to Jobmagnate but the GitHub repo itself never was.
  The WIF trust policy will bind to this actual path. Purely cosmetic
  either way — renaming the repo later doesn't require redoing WIF, just
  updating the trust condition — so not treating this as blocking.

## 1. Target architecture

```
                         ┌─────────────────────┐        ┌────────────────────┐
   Browser ── HTTPS ───► │ Cloud Run: frontend  │──IAM──►│ Secret Manager      │
                         │ (Next.js, standalone │        │ (backend secrets;   │
                         │  output, per-env)    │        │  frontend needs     │
                         └──────────┬───────────┘        │  none at runtime)   │
                                    │ HTTPS                └────────────────────┘
                                    ▼ (api.jobmagnate.com custom domain,
                         ┌─────────────────────┐          not the raw revision URL)
                         │ Cloud Run: backend   │──IAM──►│ Secret Manager      │
                         │ (Express API,        │        └────────────────────┘
                         │  per-env)            │
                         └──┬─────────┬─────────┘
                            │         │
        ADC via attached SA│         │TLS (public endpoint, no VPC connector)
                            ▼         ▼
                    ┌───────────┐  ┌──────────────────────┐
                    │ GCS bucket│  │ Neon Postgres         │
                    │ (existing)│  │ (branch per env, TLS) │
                    └───────────┘  └──────────────────────┘

  Firebase Auth: browser talks to Firebase directly (client SDK); backend only
  verifies ID tokens via firebase-admin, using ADC (same GCP project).

  Cloud Scheduler ──HTTP+OIDC──► Cloud Run Job "discovery-cron"  (replaces in-process cron)
  GitHub Actions ──WIF──► GCP (deploy, migrate, terraform apply)
```

- **Neon**: reached over the public internet with TLS (`sslmode=require`),
  same as any external Postgres — no VPC connector.
- **Frontend → backend**: the frontend build needs a *stable* backend URL.
  Map a custom domain (`api.jobmagnate.com`) onto the backend Cloud Run
  service so `NEXT_PUBLIC_API_URL` doesn't change if the backend's
  auto-generated revision URL ever would.
- **GCS + Firebase Admin**: never ship a key-file secret to Cloud Run.
  Attach a dedicated runtime service account to the backend Cloud Run
  service with `roles/storage.objectAdmin` scoped to `jobmagnet-user-data`
  and Firebase Admin rights; ADC resolves automatically — this is exactly
  the already-built "falls back to ADC" branch in `config/index.ts`.
- **Frontend Cloud Run service** needs no backend secrets at all — only
  build-time `NEXT_PUBLIC_*` values baked into the bundle.

## 2. Environments

| Environment | Neon branch | Cloud Run services | Purpose |
|---|---|---|---|
| **local** | n/a (docker-compose Postgres/Redis) | n/a | unchanged |
| **staging** | persistent `staging` branch, child of production | `jobmagnate-backend-staging`, `jobmagnate-frontend-staging`, min-instances=0 | pre-prod verification |
| **production** | the existing Neon **production** branch | `jobmagnate-backend-prod`, `jobmagnate-frontend-prod` | live traffic, `jobmagnate.com` |
| **PR preview (later, optional)** | ephemeral branch per PR, relying on `neon.ts`'s 7-day TTL as a safety net | none initially — CI-only integration tests against the branch | fast isolated test data, no deploy cost |

## 3. Terraform structure

Directories-per-environment (not workspaces) — explicit plan/apply per
environment, clean gate for a manual-approval step on production, no
workspace state-file foot-guns.

```
infra/terraform/
  bootstrap/                     # one-time, applied manually, ~never touched again
    main.tf                      # GCS state bucket (versioned, native locking),
                                  # Artifact Registry repo, WIF pool+provider, deployer SA
  modules/
    cloud-run-service/           # generic Cloud Run v2 service (image, env vars,
                                  # secret refs, service account, scaling, ingress, domain mapping)
    cloud-run-job/                # migration job + discovery-cron job
    secret-manager-secret/       # google_secret_manager_secret + IAM binding
    service-account/             # least-privilege SA + role bindings
    cloud-scheduler-job/         # HTTP+OIDC trigger for the discovery-cron job
  environments/
    staging/
      backend.tf                 # gcs backend, prefix "env/staging"
      main.tf                    # wires modules: backend service, frontend service,
                                  # their SAs, secrets, scheduler+job
      variables.tf
      terraform.tfvars           # non-secret values only
    production/
      backend.tf                 # gcs backend, prefix "env/production"
      main.tf
      variables.tf
      terraform.tfvars
```

- **State backend**: one GCS bucket (created in `bootstrap/`), versioned,
  native GCS-backend locking; `staging`/`production` use distinct object
  prefixes so state never collides.
- **IAM (least privilege)**: separate runtime SA per Cloud Run service —
  `jobmagnate-backend-staging@…`, `jobmagnate-backend-prod@…`,
  `jobmagnate-frontend-staging@…`, `jobmagnate-frontend-prod@…` — each
  scoped only to what it needs (its own Secret Manager secrets; only the
  backend SAs get GCS/Firebase Admin rights). A separate **deployer SA**
  (used by GitHub Actions via WIF) with just enough rights to push images,
  run `terraform apply`, and update Cloud Run — never the runtime SAs' own
  permissions.
- Staging/prod isolation is entirely via this naming + IAM separation, not
  a project boundary — a deliberate trade-off per the decision above, worth
  re-examining before there's real user data at meaningful scale.

## 4. CI/CD via GitHub Actions

| Workflow | Trigger | Does |
|---|---|---|
| `ci-backend.yml` | PR (paths: `backend/**`) | `npm ci`, `tsc --noEmit`, `npm test` (existing Jest suite, `tests/setupEnv.ts` hermetic-env pattern unchanged) |
| `ci-frontend.yml` | PR (paths: `frontend/**`) | `npm ci`, `next lint`, `npm test`, `npm run build` |
| `terraform-plan.yml` | PR (paths: `infra/terraform/**`) | `terraform fmt -check`, `validate`, `plan` per environment dir, posts plan as a PR comment; auth via WIF |
| `terraform-apply-staging.yml` | push to main (paths: `infra/terraform/environments/staging/**`) | auto-`apply` for staging |
| `terraform-apply-production.yml` | push to main / tag (paths: `.../production/**`) | `apply` gated by a GitHub Environment with required reviewers |
| `deploy-backend.yml` | push to main / release tag | build backend Docker image → push to Artifact Registry (tag = git SHA) → run migration step (§6) → deploy new revision → health-check `/health` → shift traffic → auto-rollback on failure |
| `deploy-frontend.yml` | push to main / release tag | build frontend Docker image (standalone Next.js output) → push → deploy new revision → health-check → shift traffic |
| *(discovery cron)* | n/a — becomes Cloud Scheduler → Cloud Run Job | not a GitHub Actions workflow at all, listed here only to make the move explicit |

**Auth**: Workload Identity Federation (`google-github-actions/auth`) — no
long-lived SA key in GitHub Secrets, trust scoped to the exact repo
(`thepriyank/CareerCopilot`, confirmed via `git remote -v`). Requires the
bootstrap Terraform step from Phase A.

**Dockerfiles**: none exist yet. Need a multi-stage Node 20 `backend/Dockerfile`,
and a `frontend/Dockerfile` using Next.js's `output: 'standalone'` build mode
(smallest runnable image, no separate Node server needed) — both new
scaffolding, sequenced into Phase A/B below.

## 5. Secrets/config mapping (every `backend/.env.example` var)

| Var | Destination | Notes |
|---|---|---|
| `PORT` | plain env var | Cloud Run injects its own `PORT`; keep as override-friendly default |
| `NODE_ENV` | plain env var | `production` in both staging and prod services |
| `CORS_ORIGIN` | Terraform var → plain env var | the frontend's custom domain, per environment |
| `DATABASE_URL` | **Secret Manager** | the Neon branch's connection string, per environment |
| `JWT_SECRET` | **Secret Manager** | generated once per environment, never shared staging/prod |
| `JWT_EXPIRES_IN` | plain env var | not sensitive |
| `FIREBASE_PROJECT_ID` | plain env var | `jobmagnet-6a1ab` |
| `FIREBASE_KEY_FILE` / `FIREBASE_CREDENTIALS_JSON` | **not shipped** | ADC via attached SA |
| `LLM_PROVIDER_ORDER`, `LLM_COOLDOWN_MS`, `LLM_ALLOW_PAID` | plain env vars | tuning |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OLLAMA_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | **Secret Manager** (one each; unset ones simply not created — matches "absent = provider skipped") | `*_MODEL` overrides are plain env vars |
| `SETTINGS_ENCRYPTION_KEY` | **Secret Manager** | per-environment, never reused staging/prod — rotating it invalidates existing users' saved model connections |
| `THEIRSTACK_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `JSEARCH_RAPID_API_KEY`, `JSEARCH_OPEN_WEB_NINJA_API_KEY` | **Secret Manager** (optional; unset ones not created) | |
| `JOB_DISCOVERY_CRON_ENABLED`, `JOB_DISCOVERY_CRON_SCHEDULE` | superseded by Cloud Scheduler config | not passed to the web service once cron moves to a Cloud Run Job |
| `JOB_MATCH_MIN_SCORE`, `JOB_MATCH_MAX_LISTINGS_TO_SCORE` | plain env vars | tuning |
| `UPLOAD_DIR`, `MAX_FILE_SIZE` | plain env vars | `UPLOAD_DIR` irrelevant once GCS is set, kept for parity |
| `GCS_BUCKET_NAME`, `GCS_PROJECT_ID` | plain env vars | not sensitive |
| `GCS_KEY_FILE` / `GCS_CREDENTIALS_JSON` | **not shipped** | ADC via attached SA |
| `REDIS_URL` | **not set at all** | Redis skipped for MVP — see Decisions |
| `LLM_CACHE_TTL_SECONDS`, `LLM_RATE_LIMIT_MAX`, `LLM_RATE_LIMIT_WINDOW_SECONDS` | plain env vars | inert without `REDIS_URL`, kept for when Redis is added back |

Frontend `NEXT_PUBLIC_*` values compile into the JS bundle at **build time**
— not secrets (Firebase web config is meant to be public), supplied as
plain GitHub Actions build args, not Secret Manager. `NEXT_PUBLIC_API_URL`
points at the backend's custom domain (see §1), not its raw revision URL.

**GitHub Actions-side secrets** (distinct from Secret Manager): WIF
provider/pool identifiers (not secret, repo variables), and — only once
Phase G's ephemeral-preview branches are adopted — a Neon API key scoped
for CI branch create/delete. Nothing else; app secrets live in Secret
Manager, not duplicated into GitHub.

## 6. Rollout / safety

- **Health checks**: `GET /health` (already exists) as the Cloud Run
  liveness probe target; each deploy workflow polls it before shifting
  traffic.
- **Rollback**: Cloud Run keeps prior revisions by default —
  `gcloud run services update-traffic --to-revisions=<previous>=100` is a
  one-command rollback; the deploy workflow should record the previous
  revision ID as an output and auto-rollback on health-check failure.
- **Migration ordering** (fixes the boot-time-migration hazard above):
  1. Gate `runMigrations()` in `index.ts` behind an explicit flag (e.g.
     only runs when `NODE_ENV !== 'production'`, default `false` in Cloud
     Run) — local dev keeps today's behavior unchanged.
  2. Add a **run-once migration step** to the deploy pipeline, before the
     new revision receives traffic: a dedicated **Cloud Run Job** built
     from the same backend image with the migration command as its
     entrypoint override, invoked via `gcloud run jobs execute` — the DB
     secret never leaves GCP, only that Job's own SA reads it.
  3. Defense-in-depth: wrap the migration run in a Postgres advisory lock
     (`pg_try_advisory_lock`) so an accidental concurrent invocation no-ops
     instead of racing — reuses the same pattern
     `docs/architecture_hardening_plan.md`'s deferred Phase 5 already
     planned for the discovery cron.
- **`discoveryCron.ts` rework**: remove `startDiscoveryCron()` from the
  always-on web service in deployed environments; replace with **Cloud
  Scheduler** (matching today's 1:30/11:30 UTC default) invoking a
  **separate Cloud Run Job** (same image, different entrypoint calling
  `runScheduledDiscovery()` directly) via OIDC-authenticated trigger — gives
  single-invocation semantics natively instead of relying on an in-memory
  guard that's only correct for one process. Small code change: extract a
  standalone script/entrypoint. Sequenced in Phase E.

## 7. Rough cost expectations (low traffic)

| Item | Estimate/month |
|---|---|
| Cloud Run × 2 services (scale-to-zero, low traffic) | ~$0–5 |
| Artifact Registry (a handful of tagged images) | ~$0.50–1 |
| Secret Manager (~20 secrets × 2 environments, low access volume) | ~$1–2 |
| Cloud Scheduler (2 jobs) | free tier covers this |
| Neon Postgres | free tier during pre-launch |
| Redis | $0 (skipped for MVP) |
| GitHub Actions minutes | free tier likely sufficient |

**Bottom line: roughly $2–10/month** at low traffic, thanks to no VPC
connector anywhere and Redis deferred.

## 8. Phased delivery order

- **Phase A** — Terraform for `staging`, applied manually (not via CI yet):
  bootstrap module (state bucket, Artifact Registry, WIF pool — even if
  unused by CI yet), staging backend + frontend Cloud Run services and
  Secret Manager secrets populated by hand, staging Neon branch created
  manually. Prove the shape before automating it.
- **Phase B** — GitHub Actions CI for tests only (`ci-backend.yml`,
  `ci-frontend.yml`) — no deploy, no cloud credentials needed. Immediate
  value, zero infra risk.
- **Phase C** — Automated Terraform plan-on-PR / apply-on-merge for staging,
  using WIF from Phase A, trust-bound to `thepriyank/CareerCopilot` (see
  Facts above). Production apply stays manual for now.
- **Phase D** — Automated deploy to staging for both services
  (`deploy-backend.yml`, `deploy-frontend.yml`) — still with migrations
  running the "old" boot-time way, since staging is unlikely to run
  multiple instances yet, but exercising the full pipeline shape with real
  Docker images.
- **Phase E** — Migration safety + discovery-cron rework (§6). Only after
  this phase is production considered safe with `min-instances > 0` or any
  rolling deploy with overlapping instances.
- **Phase F** — Production Terraform + deploy pipeline, mirroring staging
  with the manual-approval GitHub Environment gate on both Terraform apply
  and deploy.
- **Phase G (optional/stretch)** — Ephemeral per-PR Neon branches for CI
  integration tests (leveraging the existing 7-day TTL policy already in
  `neon.ts`), and — only with real appetite for the added cost/complexity —
  deployed per-PR preview Cloud Run services.
- **Later, if needed** — reintroduce Redis (point `REDIS_URL` at an
  external managed provider, e.g. Upstash) once caching or rate-limiting
  actually matters; no code change required, the fail-open path already
  exists.

## Critical files

- `backend/src/index.ts`
- `backend/src/config/dataSource.ts`
- `backend/src/config/index.ts`
- `backend/src/services/jobs/discoveryCron.ts`
- `backend/.env.example`
- `frontend/.env.local.example`
- `neon.ts`
- `docs/architecture_hardening_plan.md`
- `docker-compose.yml`
- `ARCHITECTURE.md` §7
