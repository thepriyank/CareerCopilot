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
| Backend Cloud Run service | `jobmagnate-backend-staging` — https://jobmagnate-backend-staging-w4642vyi6a-as.a.run.app — image tag `20260908-182216` |
| Frontend Cloud Run service | `jobmagnate-frontend-staging` — https://jobmagnate-frontend-staging-w4642vyi6a-as.a.run.app — image tag `20260908-182216-amd64` (note the `-amd64` suffix — see deploy history step 7) |
| Backend runtime SA | `jobmagnate-be-staging@jobmagnet-6a1ab.iam.gserviceaccount.com` (`roles/storage.objectAdmin` on `jobmagnet-user-data` only — no other project roles; no Firebase-specific role needed, see `main.tf`'s comment on why) |
| Frontend runtime SA | `jobmagnate-fe-staging@jobmagnet-6a1ab.iam.gserviceaccount.com` (zero project roles — calls no GCP APIs itself) |
| Neon branch | `staging` (`br-muddy-dream-b3x0ok39`), parent `production` |
| Cloud Run scaling | backend: min 0 / max **1** (capped — Phase E migration/cron safety hasn't landed, see plan doc §6/§8); frontend: min 0 / max 3 |
| Redis | **not configured anywhere** — deliberate, see plan doc's Redis decision |

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

## `production` environment

**Not created yet.** Copy `environments/staging/` per `docs/cicd_terraform_plan.md` Phase F when ready — same modules, its own `terraform.tfvars`, its own Neon branch (the existing `production` branch, already the Neon default), its own secrets (never share staging's).

## Known limitations / deferred work

(Full detail in `docs/cicd_terraform_plan.md` — this is just the pointer list)

- **Migrations + discovery cron still run in-process on every boot** (`backend/src/index.ts`) — Phase E (dedicated Cloud Run Job + Cloud Scheduler + advisory lock) hasn't landed. Staging's `max_instances=1` is a partial mitigation, not the real fix.
- **No custom domain mapped** — both services use their auto-generated `*.run.app` URL. `jobmagnate.com` mapping is straightforward to add to `modules/cloud-run-service` when there's a domain to verify.
- **No GitHub Actions workflows exist yet** — every apply so far has been run manually from a developer machine with real `gcloud` ADC. The WIF trust bootstrap already set up is what those workflows will use once built (Phases B–D).
- **`GROQ_API_KEY` has no real value** — add it back to `enabled_secrets` in `environments/staging/variables.tf` once one exists.

## How to verify current real state (don't trust this file blindly)

```bash
cd infra/terraform/environments/staging && terraform output
gcloud run services list --project jobmagnet-6a1ab --region asia-southeast1
gcloud secrets list --project jobmagnet-6a1ab --filter="name:jobmagnate-staging"
```

(Neon branch state: use the Neon MCP tools' `list_branches`, or `neon branches list --project-id polished-unit-87797764` if using the CLI directly.)
