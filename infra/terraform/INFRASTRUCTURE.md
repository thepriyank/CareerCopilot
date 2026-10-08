# Jobmagnate Infrastructure — Current State

**Read this first** before touching `infra/terraform/**` or reasoning about
deployed infra. This is the "what's actually real right now" reference —
distinct from the other two infra docs, which serve different purposes:

| Doc | Answers |
|---|---|
| `docs/cicd_terraform_plan.md` | *Why* it's built this way — decisions, trade-offs, full phased roadmap |
| `infra/terraform/README.md` | *How* to run it — step-by-step apply/populate-secrets/verify runbook |
| **This file** | *What exists right now* — real resource names, URLs, IDs, status |

**Last full re-sync against live GCP / Neon / GitHub: 2026-10-07 (NM-17).**
Every resource below was confirmed with the commands in "How to verify"
on that date. This file can still drift — anything consequential, check
live first.

**Keep it current.** Whenever you change infra (`terraform apply` a real
diff, add/remove a resource, rotate a secret catalog) or confirm something
this file flagged as unverified, update the relevant section here in the
same change, and add a changelog line. A stale "not yet applied" note is
worse than no note — the 2026-10-07 re-sync found several, and they caused
real mistakes (see that changelog entry).

**Changelog (most recent first):**

- **2026-10-08** — Release-process cleanup: merged `production` back into
  `main` (`361539f`) so `main` now carries the production-only Razorpay
  Terraform entries and the deploy-bookkeeping commits — the two branches
  are file-identical. New rule: back-merge `production` into `main` after
  every release (see CI/CD). Doc + git only — no infra change.

- **2026-10-07** — **Full re-sync (NM-17).** Rewritten against live state:
  production marked live with its real resources; the link-check job is
  applied and running (was "not yet applied"); job-cleanup and pass-expiry
  jobs documented (were missing); secrets listed per environment as they
  actually exist (Razorpay test keys on staging, live on production);
  `master` branch gone (default is `main`); Groq live on production. Also
  documented the **shared database** (owner decision): staging and
  production both run on the Neon `staging` branch. Stale docs here had led
  to two real mistakes on 2026-09-24 — a `terraform plan` run from `main`'s
  copy of production config (which lacks production-only Razorpay entries)
  and test writes to what was believed to be a dev database. Doc-only.
- **2026-09-24** — NM-29 (production only): `jobmagnate-llm-catalog-production`
  (weekly) + `jobmagnate-llm-health-production` (daily) Cloud Run Jobs,
  schedulers, invoker SA `jm-llm-sched-production`; Slack webhook secret
  created by the owner and adopted via `terraform import`.
- **2026-09-23** — Production: Groq key enabled (owner-created secret,
  `terraform import`); `www.jobmagnate.com` domain mapping (redirect-only);
  **Cerebras removed** from both environments (secrets destroyed); production
  Gemini key rotated (version 2). `LLM_PROVIDER_ORDER` now
  `groq,gemini,openrouter,ollama,deepseek,anthropic,openai`.
- **2026-09-22** — Link-health-check job (staging, NM-26) written; since
  applied — running daily.
- **2026-09-21** — Production: `api.jobmagnate.com` domain mapping; live
  Razorpay secrets (`rzp_live_*`).
- **2026-09-13** — Production first live: `jobmagnate.com` mapped to the
  production frontend.
- **2026-09-10** — Daily discovery job verified on its own schedule.
- **2026-09-09** — Discovery moved to a Cloud Run Job + Scheduler.
- **2026-09-08** — Bootstrap + staging first applied. See "Staging deploy
  history" below.

---

## At a glance

| | |
|---|---|
| GCP project (single project for all environments) | `jobmagnet-6a1ab` (project number `764795049074`) |
| Region (next to Neon's Singapore region) | `asia-southeast1` |
| Neon project | `polished-unit-87797764` (org `org-wild-field-89493590`) |
| Database | **One shared Neon branch for staging + production** — see "Database" |
| GitHub repo (WIF trust bound to this name) | `thepriyank/CareerCopilot` (repo id `1245891762`, **public**). Moving to a company org: NM-30 |
| Branches | `main` = staging (GitHub default), `production` = production. (`master` no longer exists.) |
| Artifact Registry | `asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate` (`backend` / `frontend` images, tagged by commit SHA) |
| Terraform state | bootstrap: **local** file on the owner's machine; environments: `gs://jobmagnet-6a1ab-tfstate/env/<staging\|production>` |
| DNS | Cloudflare (GoDaddy is only the registrar) — see "Custom domains" |

## Database

**Shared database — deliberate (owner decision, confirmed 2026-10-07).**
Staging and production both use the Neon branch named `staging`
(`br-muddy-dream-b3x0ok39`, endpoint `ep-mute-snow-b3twyzgn`): both
`jobmagnate-staging-database-url` and `jobmagnate-production-database-url`
hold the same connection string. The branch named `production`
(`br-lucky-term-b3v6w6c4`) is the Neon project default but **unused** — it
has no app tables.

Consequences to keep in mind:
- Staging deploys run migrations (on backend boot) against live user data.
- Anything done on staging — or in local dev, whose `backend/.env` points at
  the same endpoint — reads and writes production data.
- Production-only jobs (NM-29) write tables staging also reads, and
  staging-only jobs (discovery, link-check, cleanup, pass-expiry) write
  tables production reads.
- To query production data via the Neon MCP tools, use branch
  `br-muddy-dream-b3x0ok39`, not `br-lucky-term-b3v6w6c4`.

If the environments are ever separated, that's its own planned change
(choose the production branch, migrate data, switch
`jobmagnate-production-database-url`, maintenance window) — not a side
effect of other work.

## Bootstrap (`infra/terraform/bootstrap/`) — applied 2026-09-08

One-time, rarely touched. Creates:
- State bucket `jobmagnet-6a1ab-tfstate` (versioned, public access blocked)
- Artifact Registry repo `jobmagnate`
- Deployer SA `jobmagnate-deployer@jobmagnet-6a1ab.iam.gserviceaccount.com`
  — impersonated by every deploy/Terraform GitHub Actions workflow via WIF
- WIF pool/provider `github-actions-pool` / `github-actions-provider` —
  `attribute_condition` trusts `assertion.repository ==
  "thepriyank/CareerCopilot"` **by name** (moving the repo breaks this; see
  NM-30 for the plan to pin it to the repo id first)
- Required GCP APIs (Cloud Run, Artifact Registry, Secret Manager, IAM, IAM
  Credentials, STS, Resource Manager, Cloud Scheduler, Compute)

State: **local** (`infra/terraform/bootstrap/terraform.tfstate`, gitignored
— this config creates the bucket everything else's state lives in, so it
can't use that bucket itself). It can only be applied from the machine
holding that file.

## Environments

Both environments are **live** and continuously deployed by GitHub Actions
(see "CI/CD"). Same Terraform modules; values differ.

| | Staging (`environments/staging/`) | Production (`environments/production/`) |
|---|---|---|
| Deployed from | push to `main` | push to `production`, **required-reviewer approval** (`production` GitHub Environment) |
| Backend service | `jobmagnate-backend-staging` — https://jobmagnate-backend-staging-w4642vyi6a-as.a.run.app | `jobmagnate-backend-production` — **https://api.jobmagnate.com** (raw: https://jobmagnate-backend-production-w4642vyi6a-as.a.run.app) |
| Frontend service | `jobmagnate-frontend-staging` — https://jobmagnate-frontend-staging-w4642vyi6a-as.a.run.app | `jobmagnate-frontend-production` — **https://jobmagnate.com** (+ `www` redirect) |
| Scaling | backend min 0 / max **1**; frontend min 0 / max 3 | same |
| Backend runtime SA | `jobmagnate-be-staging@…` | `jobmagnate-be-production@…` |
| Frontend runtime SA | `jobmagnate-fe-staging@…` (no project roles) | `jobmagnate-fe-production@…` (no project roles) |
| Database | shared Neon `staging` branch — see "Database" | same |
| Razorpay | **test** keys (`rzp_test_*`) | **live** keys (`rzp_live_*`) |
| Background jobs | discovery, job-cleanup, link-check, pass-expiry | LLM catalog refresh + LLM health check |
| Image in use | see `environments/staging/image_tags.tfvars` | see `environments/production/image_tags.tfvars` |
| State | `gs://jobmagnet-6a1ab-tfstate/env/staging` | `gs://jobmagnet-6a1ab-tfstate/env/production` |

Backend runtime SAs hold `roles/storage.objectAdmin` on `jobmagnet-user-data`
(résumé files) plus `secretAccessor` on their own environment's secrets — no
other project roles. Redis is **not configured anywhere** (deliberate; the
app no-ops its LLM cache without it).

**Production Terraform runs from the `production` branch.** Since the
2026-10-08 back-merge (`361539f`), `main` carries everything `production`
has — including the live Razorpay secret entries that used to exist only on
`production` (committed there directly on 2026-09-21), which is why
planning production from `main` used to show them being destroyed. Even so,
**run production `terraform plan`/`apply` from the `production` branch (or
a worktree of it, with a branch check)** — that's what the apply workflow
uses, and `main` can be ahead between releases.

### Secrets (Secret Manager, as of 2026-10-07)

All named `jobmagnate-<env>-<name>`. Values never pass through Terraform —
a secret is created empty by Terraform (or by the owner and then adopted
with `terraform import`) and populated with `gcloud secrets versions add`
or the console. A Cloud Run service referencing a secret with **no
version** fails to deploy, so populate before enabling.

| Secret | Staging | Production |
|---|---|---|
| `database-url` | ✅ (shared DB) | ✅ (same value) |
| `jwt-secret`, `settings-encryption-key` | ✅ | ✅ |
| `gemini-api-key`, `ollama-api-key`, `openrouter-api-key` | ✅ | ✅ (Gemini rotated 2026-09-23) |
| `groq-api-key` | — | ✅ (imported 2026-09-23) |
| `razorpay-key-id`, `razorpay-key-secret`, `razorpay-webhook-secret` | ✅ test | ✅ live (production-branch-only config) |
| `slack-alerts-webhook` | — | ✅ (NM-29, imported 2026-09-24) |
| `adzuna-app-id`, `adzuna-app-key` | ✅ | — |
| `internal-ingest-token` | ✅ (JobSpy scraper → job pool) | — |

Removed: `cerebras-api-key` (both, 2026-09-23). Not provisioned anywhere:
DeepSeek / Anthropic / OpenAI keys (`LLM_ALLOW_PAID=false`), Jooble /
JSearch / TheirStack keys.

## Background jobs (Cloud Run Jobs + Cloud Scheduler)

All run the **backend image** with a different entrypoint, as the
environment's backend runtime SA, and are re-pointed at each new backend
image by the deploy workflow. Each has its own invoker SA holding only
`roles/run.invoker` on that one job. All schedules are UTC.

| Job | Env | Entrypoint | Schedule (UTC → IST) | Invoker SA |
|---|---|---|---|---|
| `jobmagnate-discovery-staging` | staging | `dist/scripts/runDiscovery.js` | `30 1 * * *` → 07:00 daily | `jobmagnate-disc-sched-staging` |
| `jobmagnate-job-cleanup-staging` | staging | `dist/scripts/runJobCleanup.js` | `0 2 * * 2` → Tue 07:30 | `jobmagnate-clean-sched-staging` |
| `jobmagnate-link-check-staging` | staging | `dist/scripts/runLinkCheck.js` | `0 3 * * *` → 08:30 daily | `jobmagnate-link-sched-staging` |
| `jobmagnate-pass-expiry-staging` | staging | `dist/scripts/runPassExpiryCheck.js` | `0 4 * * *` → 09:30 daily | `jobmagnate-exp-sched-staging` |
| `jobmagnate-llm-catalog-production` | production | `dist/scripts/runModelCatalogRefresh.js` | `0 2 * * 1` → Mon 07:30 | `jm-llm-sched-production` |
| `jobmagnate-llm-health-production` | production | `dist/scripts/runLlmHealthCheck.js` | `30 2 * * *` → 08:00 daily | `jm-llm-sched-production` |

All six ran successfully on their latest scheduled run (checked 2026-10-07).

**Why staging jobs aren't on production, and vice versa.** The four
job-pool jobs are staging-only by product decision (2026-09-22): unproven
background jobs stay off production's schedule and compute. The two LLM
jobs are production-only by decision (NM-29): they watch production's own
LLM keys. Both `staging/main.tf` and the top of `production/main.tf` carry
comments saying so — don't "mirror" either set across in a parity pass.
Because the database is shared, each set's *writes* are still visible to
both environments.

**What they do:**
- **Discovery** — pulls listings from job providers, keeps only
  software-engineering roles (`isSoftwareEngineeringRole()`, applied to
  every provider's output), inserts new ones. Some providers erroring per
  run is normal (free remote boards rate-limit; Jooble/JSearch/TheirStack
  have no keys) — check the run's logs if volume looks thin. Replaced the
  in-process `node-cron` (`JOB_DISCOVERY_CRON_ENABLED` stays `"false"` on the
  web service), which never fired reliably at `min_instances=0`.
- **Job cleanup** — weekly **hard-delete** of listings that have been
  `EXPIRED` for `PURGE_AFTER_EXPIRED_DAYS` or more
  (`services/jobs/jobCleanup.ts`). A no-op until `CLEANUP_STARTS_AT`
  (**2026-12-01**), gated in code. ⚠️ With the shared database, this
  staging job's deletes also remove those listings from production.
- **Link check** (NM-26) — `HEAD`s a batch of 300 `ACTIVE` listings'
  posting URLs (oldest/never-checked first; `GET` only on 405); marks a
  listing `EXPIRED` on a clean 404/410, or after 2 consecutive ambiguous
  failures across daily runs. Logic: `backend/src/services/jobs/linkHealthCheck.ts`.
- **Pass expiry** — warns PREMIUM users once before their pass lapses
  (in-app notification). Logic: `services/notifications/passExpiryNotifier.ts`.
- **LLM catalog refresh / health** (NM-29) — list and probe every free LLM
  provider's models, rank them in `llm_model_catalog` (read by the web
  service, cached 10 min), and post provider problems to the owner's Slack.
  Design: `docs/NM-29_plan.md`.

Run any job by hand: `gcloud run jobs execute <job> --region asia-southeast1
--project jobmagnet-6a1ab` (or `gcloud scheduler jobs run <job> --location
asia-southeast1 …` to go through the scheduler).

## Custom domains (production only)

All `google_cloud_run_domain_mapping` in `environments/production/main.tf`;
staging stays on `*.run.app`. **DNS is in Cloudflare** (nameservers
`lina` / `marty.ns.cloudflare.com`; GoDaddy is only the registrar, its DNS
panel is ignored). Every record pointing at Cloud Run must be **DNS only
(grey cloud)** — proxying blocks Google's managed-certificate issuance.
Cloudflare also hosts the MX records for email forwarding.

| Host | Maps to | DNS |
|---|---|---|
| `jobmagnate.com` | `jobmagnate-frontend-production` | apex A/AAAA from `terraform output custom_domain_dns_records` |
| `api.jobmagnate.com` | `jobmagnate-backend-production` | CNAME `ghs.googlehosted.com` (2026-09-21) |
| `www.jobmagnate.com` | `jobmagnate-frontend-production`, **redirect only** | CNAME `ghs.googlehosted.com` (2026-09-23) — `frontend/src/middleware.ts` 308s to the apex, path + query kept |

All three mappings report Ready with certificates provisioned.

## CI/CD

| Workflow | Trigger | Does |
|---|---|---|
| `ci-backend.yml` / `ci-frontend.yml` | PRs + push to `main` (by path) | typecheck + tests |
| `deploy-backend.yml` / `deploy-frontend.yml` | push to `main` (by path) | build `linux/amd64` image tagged by commit SHA, write `staging/image_tags.tfvars`, `terraform apply`, health check (roll back on failure), commit `chore(staging): deploy …` back to `main` |
| `terraform-apply-staging.yml` | push to `main` touching `environments/staging/**` or `modules/**` | `terraform apply` staging |
| `deploy-*-production.yml`, `terraform-apply-production.yml` | push to `production` (by path) | same as staging, against production; **paused for required-reviewer approval** (reviewer: `thepriyank`) |
| `terraform-plan.yml` | PRs touching `infra/terraform/**` | plan both environments |

Notes:
- **Release cycle (rule since 2026-10-08, also in `CLAUDE.md`):**
  1. Changes land on `main` only — never commit or push straight to
     `production`.
  2. `main` deploys to staging; check it there.
  3. Release: PR from `main` into `production`, merged with **"Create a
     merge commit"** (never squash/rebase), then approve the production
     deploy runs.
  4. **Back-merge:** merge `production` into `main` and push, so `main`
     also has the `chore(production): deploy …` image-tag commits.
     Afterwards `git diff origin/main origin/production` must be empty.
- **History note:** before 2026-10-08, four commits went straight to
  `production` (`6a2a9a3` api domain mapping, `6183bf5`/`94f39ed` Razorpay
  secrets, `6dd6b5c` a webhook fix that was also on `main`). The 2026-10-08
  back-merge reconciled them; the trees are identical since `361539f`.
- **Branch protection on `production`: not yet enforced** — a ruleset that
  lets only GitHub Actions push can't be created on a *personal* repo
  (GitHub rejects an Integration bypass outside an organization). Options:
  deploy-key bypass for the deploy workflows, admin bypass (doesn't stop
  direct pushes by admins), or wait for the org move (NM-30).
- All workflows authenticate to GCP keylessly via WIF as
  `jobmagnate-deployer` — **no GitHub secrets**. GitHub holds only 4
  repository **variables** (`NEXT_PUBLIC_FIREBASE_*`) used at frontend build.
- The staging workflows share one concurrency group (`terraform-staging`),
  and the production ones share `terraform-production`. GitHub keeps only
  **one pending run per group**, so when several are queued, one is often
  **cancelled** — re-run it (`gh run rerun <id>`). Deploy workflows apply
  the full Terraform config, so a cancelled `terraform-apply-*` run is
  usually redundant.
- Deploy workflows push commits straight to `main` / `production`; any
  future branch protection needs a GitHub Actions bypass.
- None of the workflows has `workflow_dispatch`.

## Staging deploy history (2026-09-08 — lessons that still apply)

First bring-up hit three problems worth remembering:
1. **A secret with no version breaks service creation** — Cloud Run fails to
   create a service whose `secretKeyRef` can't resolve. Populate secrets
   before (or in a separate apply from) the service that references them.
2. **Build for `linux/amd64`** — the build host is arm64 and Cloud Run
   rejects arm64 images. Always `docker buildx build --platform linux/amd64`.
3. **Never reuse an image tag** — Terraform/Cloud Run compare the `image`
   field as a string, so a re-pushed image under an already-applied tag is
   invisible to the next plan. The workflows now tag by commit SHA.

Also: Cloud Run v2's `deletion_protection` (default true) blocked replacing
a tainted service; `modules/cloud-run-service` sets it to `false`.

## Known limitations / deferred work

- **Migrations run in-process on every backend boot** (`backend/src/index.ts`)
  with no advisory lock — only safe because backend `max_instances = 1`.
  Raising that needs the lock first. With the shared database, a staging
  deploy's migration also changes production's schema.
- **Known Terraform drift** on `backend_service` / `frontend_service`: a
  `scaling` block's `manual_instance_count` / `min_instance_count` shows as
  "update in-place" on every plan. Harmless (absent block = same defaults).
- **WIF trust is bound to the repo *name*** — see NM-30 before moving the
  repo.
- **The GitHub repo is public.**

## How to verify current real state (don't trust this file blindly)

```bash
P=jobmagnet-6a1ab; R=asia-southeast1
gcloud run services list --project $P --region $R
gcloud run jobs list --project $P --region $R
gcloud scheduler jobs list --project $P --location $R
gcloud beta run domain-mappings list --project $P --region $R
gcloud secrets list --project $P --format="value(name)"
gcloud run jobs executions list --job <job> --project $P --region $R --limit 5
gh run list --branch production --limit 10      # release status
```

Neon: the MCP tools' `list_branches` / `list_postgres_endpoints`, or
`neon branches list --project-id polished-unit-87797764`. Which endpoint an
environment really uses: decode the host from its `database-url` secret
(don't print the credentials).
