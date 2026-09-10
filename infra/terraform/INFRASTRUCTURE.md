# Jobmagnate Infrastructure — Current State

**Read this first** before touching `infra/terraform/**` or reasoning about
deployed infra. This is the "what's actually real right now" reference —
distinct from the other two infra docs, which serve different purposes:

| Doc | Answers |
|---|---|
| `docs/cicd_terraform_plan.md` | *Why* it's built this way — decisions, trade-offs, full phased roadmap |
| `infra/terraform/README.md` | *How* to run it — step-by-step apply/populate-secrets/verify runbook |
| **This file** | *What exists right now* — real resource names, URLs, IDs, status |

This file can drift from reality (someone applies changes without updating
it). Don't trust it blindly for anything consequential — the "How to verify"
section at the bottom gives the commands that ask GCP/Neon directly.

**Keep it current.** Whenever you change infra (`terraform apply` a real
diff, add/remove a resource, rotate a secret catalog) or confirm something
that this file previously flagged as unverified, update the relevant
section here in the same change. A stale "not yet verified" note is worse
than no note.

**Changelog (most recent first):**

- **2026-09-10** — Verified the daily discovery job runs end-to-end on its
  own schedule (was "not yet verified"). Marked the "committed source
  predates the real app" limitation RESOLVED — the real app has been on
  `main` since `31c2d73`/`08b1e3a` and all `ci-*`/`deploy-*` workflows run
  green per push. Added the "Ongoing deploys" note. No infra diff — doc
  status only.
- **2026-09-09** — Daily discovery moved to a dedicated Cloud Run Job +
  Cloud Scheduler; software-engineering-only scope gate added. Staging
  Neon branch seeded from local dev Postgres.
- **2026-09-08** — Bootstrap + staging environment first applied; real app
  images deployed. See "Deploy history" below.

---

## At a glance

| | |
|---|---|
| GCP project (all environments — single-project design, see plan doc) | `jobmagnet-6a1ab` |
| Region (chosen to sit next to Neon's Singapore branch) | `asia-southeast1` |
| Neon project | `polished-unit-87797764` (org `org-wild-field-89493590`) |
| GitHub repo (WIF trust is bound to exactly this) | `thepriyank/CareerCopilot` |
| Branches | `main` = staging, `production` = production, `master` = old default, being phased out — see "Branch strategy" below |
| Artifact Registry | `asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate` (one repo, `backend`/`frontend` image names) |
| Terraform state bucket | `jobmagnet-6a1ab-tfstate` (bootstrap: local state; environments: this bucket, prefix `env/<name>`) |

## Bootstrap (`infra/terraform/bootstrap/`) — applied 2026-09-08

One-time, rarely touched. Creates:
- State bucket `jobmagnet-6a1ab-tfstate` (versioned, public access blocked)
- Artifact Registry repo `jobmagnate`
- Deployer SA: `jobmagnate-deployer@jobmagnet-6a1ab.iam.gserviceaccount.com` — impersonated by GitHub Actions via WIF (not yet actually used — no workflows exist yet)
- WIF pool/provider: `github-actions-pool` / `github-actions-provider`, trust-scoped to `thepriyank/CareerCopilot`
- 8 GCP APIs enabled (Cloud Run, Artifact Registry, Secret Manager, IAM, IAM Credentials, STS, Resource Manager, Cloud Scheduler, Compute)

State: **local** (`infra/terraform/bootstrap/terraform.tfstate`, gitignored — deliberate, see `versions.tf`'s comment: this config creates the bucket everything else's remote state lives in, so it can't depend on that bucket itself).

## `staging` environment (`infra/terraform/environments/staging/`) — applied 2026-09-08

**Status: LIVE**, running real app images (not the bootstrap placeholder — see "Deploy history" below).

| Resource | Value |
|---|---|
| Backend Cloud Run service | `jobmagnate-backend-staging` — https://jobmagnate-backend-staging-w4642vyi6a-as.a.run.app — image tag tracks whatever `deploy-backend.yml` last pushed; check `environments/staging/image_tags.tfvars` for the current one, not this table |
| Frontend Cloud Run service | `jobmagnate-frontend-staging` — https://jobmagnate-frontend-staging-w4642vyi6a-as.a.run.app — same note |
| Backend runtime SA | `jobmagnate-be-staging@jobmagnet-6a1ab.iam.gserviceaccount.com` (`roles/storage.objectAdmin` on `jobmagnet-user-data` only — no other project roles; no Firebase-specific role needed, see `main.tf`'s comment on why) |
| Frontend runtime SA | `jobmagnate-fe-staging@jobmagnet-6a1ab.iam.gserviceaccount.com` (zero project roles — calls no GCP APIs itself) |
| Neon branch | `staging` (`br-muddy-dream-b3x0ok39`), parent `production` — seeded 2026-09-09 with the 40 real `jsearch`-sourced job listings migrated from local dev Postgres; the daily discovery job has been adding to this since (see "Daily discovery job" below) |
| Cloud Run scaling | backend: min 0 / max **1** (capped — Phase E migration/cron safety hasn't landed, see plan doc §6/§8); frontend: min 0 / max 3 |
| Redis | **not configured anywhere** — deliberate, see plan doc's Redis decision |

### Daily discovery job (Phase E fix, applied 2026-09-09)

The in-process `node-cron` in `discoveryCron.ts` never fires reliably on
Cloud Run (a tick landing while `min_instances=0` is idle just doesn't
run) — `JOB_DISCOVERY_CRON_ENABLED` stays `"false"` on the web service
permanently now. Replaced with a real Cloud Run Job + Cloud Scheduler:

| Resource | Value |
|---|---|
| Cloud Run Job | `jobmagnate-discovery-staging` — same image as the backend service, entrypoint overridden to `node dist/scripts/runDiscovery.js` |
| Cloud Scheduler job | `jobmagnate-discovery-staging` — `30 1 * * *` UTC (7:00am IST), once daily |
| Scheduler invoker SA | `jobmagnate-disc-sched-staging@jobmagnet-6a1ab.iam.gserviceaccount.com` — `roles/run.invoker` on just this one Job, nothing else |
| Job's runtime identity | reuses `jobmagnate-be-staging` (the backend runtime SA) — already has the Secret Manager grants it needs |

**Software-engineering scope** (2026-09-09 product decision — "we'll not
just be pulling all the jobs"): discovery now only keeps postings matching
`isSoftwareEngineeringRole()` — frontend/backend/full-stack/AI/ML, staff
or lead engineer, engineering manager, data engineer, platform/DevOps/SRE,
QA/SDET, mobile. This gate applies to **every** provider's output, not
just the keyword-search aggregators (JSearch/Adzuna/Jooble/TheirStack,
which only ever query `target-job-titles.json`'s list) — the remote-board
providers (RemoteOK/WeWorkRemotely/Himalayas) and ATS providers
(Greenhouse et al.) return their whole feed with no filtering at the
source, and a real pull surfaced plenty of noise this way before the fix
(e.g. "Executive Personal Assistant to the Founder").

**Verified working (2026-09-10).** The `30 1 * * *` UTC trigger fired on
its own at `2026-09-10T01:30Z` and the Cloud Run Job execution
(`jobmagnate-discovery-staging-kd7bv`) succeeded: 17 new listings
inserted, 40 already known, 217 non-software-engineering listings filtered
out, ~25s, exit 0. Two manual test runs on 2026-09-09 also succeeded.
Scheduler state is `ENABLED`. Each `deploy-backend.yml` run also updates
this Job's image — it shares `var.backend_image` with the backend
service — so it stays on current code automatically.

**Known caveat:** that run logged `discoveryCron: 4 provider error(s)`.
Discovery still completes and inserts jobs, but not every provider
returns — expected, because the keyword aggregators (JSearch / Adzuna /
Jooble / TheirStack) have no API keys on staging and the free
remote-board providers get rate-limited or blocked intermittently. It is
not a failure of the job. If job volume looks thin, read the latest
execution's logs to see which providers errored.

Manual trigger: `gcloud scheduler jobs run jobmagnate-discovery-staging
--location asia-southeast1 --project jobmagnet-6a1ab`, then
`gcloud run jobs executions list --job jobmagnate-discovery-staging
--region asia-southeast1 --project jobmagnet-6a1ab` and
`gcloud logging read 'resource.type="cloud_run_job"
resource.labels.job_name="jobmagnate-discovery-staging"'` for the result.

### Secrets provisioned (Secret Manager, real values populated 2026-09-08)

All under `jobmagnate-staging-*`: `database-url`, `jwt-secret` (freshly generated, not reused from local dev), `settings-encryption-key` (same), `gemini-api-key`, `cerebras-api-key`, `ollama-api-key`, `openrouter-api-key` (these 4 copied from local `backend/.env`'s real free-tier keys).

**Not provisioned**: `GROQ_API_KEY` — empty in local dev too, deliberately excluded from `enabled_secrets` rather than created with a blank value (see `variables.tf`'s comment — an empty-but-present secret would make the app think Groq is configured when it isn't). Also not provisioned: any paid-tier key (DeepSeek/Anthropic/OpenAI — `LLM_ALLOW_PAID=false`) or any job-aggregator key (none configured locally either).

State: **remote**, `gs://jobmagnet-6a1ab-tfstate/env/staging`.

### Deploy history (chronological, so a future apply's diff makes sense)

1. First apply: both services created with Google's placeholder image (`us-docker.pkg.dev/cloudrun/container/hello`) per `variables.tf`'s bootstrap-order default — **backend service failed to create**, expected per the runbook (secrets existed but had zero versions yet; Cloud Run fails service *creation* outright on an unresolvable `secretKeyRef`, not a crash-loop after the fact).
2. Populated all 7 real secret values (Neon staging branch created via Neon MCP tools; JWT/settings keys freshly generated; LLM keys copied from local `.env`); removed `GROQ_API_KEY` from `enabled_secrets`.
3. Re-applied — hit a second issue: the failed backend service was `tainted` in state, and Cloud Run v2's `deletion_protection` (defaults `true` in google provider v6) blocked the destroy-then-recreate a tainted replace normally does. Fixed via `terraform untaint` (turns it into a normal in-place update instead) + added `deletion_protection = false` explicitly to `modules/cloud-run-service` going forward.
4. Backend service came up healthy (still placeholder image). Frontend already healthy from step 1.
5. Built + pushed real `backend`/`frontend` Docker images to Artifact Registry — **first attempt built arm64 images** (the build host is arm64; Cloud Run requires amd64/linux) and Cloud Run rejected them on deploy (`must support amd64/linux`). Rebuilt both with `docker buildx build --platform linux/amd64 --push` instead of plain `docker build` + `docker push`.
6. Re-applied with `-var="backend_image=...:<timestamp-tag>"` / `-var="frontend_image=...:<timestamp-tag>"` — backend updated correctly (its old state value was still the placeholder, so the tag change was a genuine diff), but **frontend showed 0 planned changes and silently kept serving the broken arm64 image**: the earlier failed frontend apply had already written the bad tag string into Terraform state before Cloud Run rejected the revision, so re-submitting the *same* tag string (now pointing at a corrected digest in the registry) looked like no change at all to Terraform — Cloud Run/Terraform compares by tag string, not digest.
7. Fixed by aliasing a **new** tag (`20260908-182216-amd64`) to the already-pushed correct digest via `docker buildx imagetools create` (registry-side only, no rebuild) and re-applying with that. This forced a genuine string diff, and Terraform/Cloud Run picked it up correctly.
8. Verified via `gcloud logging read`: backend logs show `Database connected via TypeORM`, `Ran 3 pending migration(s): InitialSchema1788721791998, TextArrayColumns1788722004864, AddGoogleAuthToUsers1788775819815`, and `discoveryCron: disabled` — the real app, not the placeholder, genuinely running against the Neon staging branch.

**Takeaways for next time**:
- Always build for staging/production with `docker buildx build --platform linux/amd64 ... --push` (see updated `README.md` Step 2), never plain `docker build` on an arm64 host.
- **Always use a fresh, unique tag per deploy** (a timestamp is enough) — never redeploy under a tag string Terraform has already seen, even after fixing/re-pushing the image behind it. Terraform/Cloud Run's `image` field is compared as a string, not resolved-and-compared by digest, so a "fixed" image under an already-applied tag is silently invisible to the next plan.

### Ongoing deploys (2026-09-09 onward)

Since the real app source landed on `main`, staging redeploys itself on
every push. `deploy-backend.yml` / `deploy-frontend.yml` each: run
`tsc --noEmit` + tests, `docker buildx build --platform linux/amd64`
a fresh timestamped image, write it to
`environments/staging/image_tags.tfvars`, `terraform apply`, hit the
health check, roll back on failure, and commit the tfvars change back —
these are the `chore(staging): deploy ...` commits in git history. The
discovery Cloud Run Job picks up the same new `backend_image` in that
apply.

A normal application change no longer needs any manual `terraform apply`
or `docker buildx` — the `README.md` runbook is now only for infra
changes (anything other than `image_tags.tfvars`) and first-time
production bring-up.

## Branch strategy (revised 2026-09-08 — supersedes the original plan doc's assumption)

The plan doc's Phase A–F narrative was written assuming a single default
branch (`master`). The user changed this mid-implementation:

| Branch | Role |
|---|---|
| `main` | **Staging.** `ci-*.yml`, `terraform-apply-staging.yml`, `deploy-*.yml` all trigger on push here. |
| `production` | **Production.** `terraform-apply-production.yml`, `deploy-*-production.yml` trigger on push here — each gated by the `production` GitHub Environment's required-reviewer rule (configured via `gh api`, reviewer: `thepriyank`), so the job pauses for manual approval before running at all, on top of its own branch-restricted deployment policy. |
| `master` | The actual GitHub default branch (confirmed via `gh repo view`), being phased out by the user. `terraform-plan.yml` still triggers on any PR regardless of target branch, so it isn't branch-name-dependent. |

**Same deployer SA / WIF trust for both `main` and `production`** — the
WIF provider's `attribute_condition` is repo-scoped
(`thepriyank/CareerCopilot`), not branch-scoped. Production's real
protection is the required-reviewer gate, not a separate credential.
Tightening WIF trust to be branch-scoped per environment is a reasonable
future hardening step (see `bootstrap/main.tf`'s comment), not done here.

## `production` environment (`infra/terraform/environments/production/`) — created 2026-09-08

Mirrors `staging/` exactly in shape (same modules) — only the values
differ. **Not yet applied** — created and validated (`terraform validate`
passes) but no `terraform apply` has been run against it yet, unlike
staging. Still on the bootstrap placeholder image in `image_tags.tfvars`.

| Resource | Value |
|---|---|
| Backend Cloud Run service (not yet applied) | `jobmagnate-backend-production` |
| Frontend Cloud Run service (not yet applied) | `jobmagnate-frontend-production` |
| Backend runtime SA (not yet created) | `jobmagnate-be-production@jobmagnet-6a1ab.iam.gserviceaccount.com` |
| Frontend runtime SA (not yet created) | `jobmagnate-fe-production@jobmagnet-6a1ab.iam.gserviceaccount.com` |
| Neon branch | the existing **`production`** branch (`br-lucky-term-b3v6w6c4`) — already the Neon project default, not a new branch like staging's |
| Secrets (not yet created) | same catalog as staging, entirely separate Secret Manager secrets/versions — `jobmagnate-production-*`, never shared with staging's `jobmagnate-staging-*` |

**Creating the `production` branch will likely immediately queue pending
(awaiting-approval) runs** of `terraform-apply-production.yml` and both
`deploy-*-production.yml` — a new branch's initial push is treated as a
diff against nothing, so every path this branch already contains (from
being cut off `main`) looks "changed." This is expected and safe: the
required-reviewer gate means nothing actually runs until approved. Since
the real app source is now on `main` and CI is green there (see "Known
limitations"), an approved `deploy-*-production.yml` run would get past
`tsc --noEmit` / `npm test` — the remaining gate is that
`jobmagnate-production-*` secrets don't exist yet, so the backend service
would fail to create exactly as staging's first apply did (populate
secrets first, per the runbook).

## Known limitations / deferred work

(Full detail in `docs/cicd_terraform_plan.md` — this is just the pointer list)

- **~~The committed source on `main` predated the real app~~ — RESOLVED (2026-09-09).** The real application (TypeORM migration, F1–F8, auth, GCS, tests) has been committed to `main` since `31c2d73` / `08b1e3a`. `ci-backend.yml`, `ci-frontend.yml`, `deploy-backend.yml`, and `deploy-frontend.yml` now run green on every push to `main`, and staging is continuously deployed from those workflows. The failing state originally described here applied only to the pre-`31c2d73` snapshot that still imported `@prisma/client`.
- **Migrations still run in-process on every backend boot** (`backend/src/index.ts`) — no advisory lock; only mitigated by `max_instances=1`. Discovery is no longer in this bucket — it moved to the dedicated Cloud Run Job + Cloud Scheduler (see "Daily discovery job" above), verified running 2026-09-10. The rest of Phase E (an advisory lock around the in-process migration run, so `max_instances` could be raised) still hasn't landed.
- **No custom domain mapped** — every service uses its auto-generated `*.run.app` URL. `jobmagnate.com` mapping is straightforward to add to `modules/cloud-run-service` when there's a domain to verify.
- **`GROQ_API_KEY` has no real value** — add it back to `enabled_secrets` in both environments' `variables.tf` once one exists.
- **`production` environment exists in Terraform but has never been applied** — see the section above.

## How to verify current real state (don't trust this file blindly)

```bash
cd infra/terraform/environments/staging && terraform output
gcloud run services list --project jobmagnet-6a1ab --region asia-southeast1
gcloud secrets list --project jobmagnet-6a1ab --filter="name:jobmagnate-staging"

# Daily discovery job — scheduler state + recent execution results
gcloud scheduler jobs describe jobmagnate-discovery-staging \
  --location asia-southeast1 --project jobmagnet-6a1ab \
  --format="yaml(schedule,state,lastAttemptTime,status)"
gcloud run jobs executions list --job jobmagnate-discovery-staging \
  --region asia-southeast1 --project jobmagnet-6a1ab --limit 5
```

(Neon branch state: use the Neon MCP tools' `list_branches`, or `neon branches list --project-id polished-unit-87797764` if using the CLI directly.)
