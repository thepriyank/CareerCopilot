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
| Neon branch | `staging` (`br-muddy-dream-b3x0ok39`), parent `production` — seeded 2026-09-09 with the 40 real `jsearch`-sourced job listings migrated from local dev Postgres (see "Daily discovery job" below) |
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

**Not yet verified**: the Cloud Scheduler → Cloud Run Job invocation
hasn't been manually triggered and confirmed end-to-end yet (the Job was
created pointing at an image built *before* `runDiscovery.ts` existed —
needs a fresh `deploy-backend.yml` run first). Run `gcloud scheduler jobs
run jobmagnate-discovery-staging --location asia-southeast1 --project
jobmagnet-6a1ab` to trigger it manually and check
`gcloud logging read` / `gcloud run jobs executions list` for the result.

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
required-reviewer gate means nothing actually runs until approved, and
even an approved `deploy-*-production.yml` run would fail at its
`npm test`/`tsc --noEmit` step for the same reason `ci-backend.yml` /
`ci-frontend.yml` currently fail on `main` — see the next section.

## Known limitations / deferred work

(Full detail in `docs/cicd_terraform_plan.md` — this is just the pointer list)

- **The committed source on `main`/`master` predates the real, working app entirely** (discovered 2026-09-08 via PR #1's first-ever CI run — see `ci-backend.yml`/`ci-frontend.yml`'s failures there). Nothing from this project's real feature work (the TypeORM migration, F1–F8 features, auth, GCS, tests — everything) has ever been committed; git history stops at an initial "partial implementation" snapshot that still imports `@prisma/client` (no longer even a dependency) and has real TypeScript errors. `terraform-plan.yml` and `terraform-apply-*` are unaffected (they don't touch application source), but **every `ci-*.yml` and `deploy-*.yml` run will keep failing at the typecheck/test step until the real source is committed** — this is expected, not a bug in the workflows, and is a large separate piece of work the user is handling on their own timeline, not folded into the CI/CD setup itself.
- **Migrations + discovery cron still run in-process on every boot** (`backend/src/index.ts`) — Phase E (dedicated Cloud Run Job + Cloud Scheduler + advisory lock) hasn't landed. Both environments' `max_instances=1` on the backend is a partial mitigation, not the real fix.
- **No custom domain mapped** — every service uses its auto-generated `*.run.app` URL. `jobmagnate.com` mapping is straightforward to add to `modules/cloud-run-service` when there's a domain to verify.
- **`GROQ_API_KEY` has no real value** — add it back to `enabled_secrets` in both environments' `variables.tf` once one exists.
- **`production` environment exists in Terraform but has never been applied** — see the section above.

## How to verify current real state (don't trust this file blindly)

```bash
cd infra/terraform/environments/staging && terraform output
gcloud run services list --project jobmagnet-6a1ab --region asia-southeast1
gcloud secrets list --project jobmagnet-6a1ab --filter="name:jobmagnate-staging"
```

(Neon branch state: use the Neon MCP tools' `list_branches`, or `neon branches list --project-id polished-unit-87797764` if using the CLI directly.)
