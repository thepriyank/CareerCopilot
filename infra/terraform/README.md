# Jobmagnate infrastructure (Terraform)

Implements Phase A of `docs/cicd_terraform_plan.md`: bootstrap + a manually-
applied `staging` environment. Read that doc first for the *why*; this file
is the *how*.

**Nothing here has been applied yet.** Every `.tf` file has been validated
(`terraform validate`, locally, no cloud calls) but not planned or applied
against real GCP — that needs your own `gcloud` credentials and creates real,
billed resources under `jobmagnet-6a1ab`, so it's a deliberate stop-and-hand-
off point rather than something run silently.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.7 (this repo was authored/validated against 1.15.8)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install), authenticated:
  ```bash
  gcloud auth login
  gcloud auth application-default login
  gcloud config set project jobmagnet-6a1ab
  ```
- Billing enabled on `jobmagnet-6a1ab` (Cloud Run, Artifact Registry, and Secret Manager all require it)
- Docker, for building/pushing the first real images by hand (Phase A has no CI yet — that's Phase B/C/D)
- You need `roles/owner` or an equivalent broad role on the project for the
  *first* bootstrap apply (it creates IAM policy bindings and a WIF pool —
  after that, day-to-day environment applies only need what the deployer SA
  itself has)

## Step 1 — Bootstrap (once, ever)

```bash
cd infra/terraform/bootstrap
terraform init
terraform plan
terraform apply
```

Creates: the Terraform state GCS bucket, the shared Artifact Registry Docker
repo, the WIF pool/provider trusting `thepriyank/CareerCopilot`, and the
`jobmagnate-deployer` service account GitHub Actions will eventually
impersonate. Note the outputs — `terraform output` — you'll want
`artifact_registry_repo_url` for Step 2.

## Step 2 — Build and push a real image (first time only)

The staging config's `backend_image`/`frontend_image` default to Google's
public placeholder image (`.../cloudrun/container/hello`) specifically so
Step 3 doesn't fail on a chicken-and-egg problem — Terraform needs *some*
image to create the Cloud Run service before any real one has been pushed.
You can apply staging once with the placeholder to prove the plumbing works,
then redeploy with a real image:

```bash
gcloud auth configure-docker asia-southeast1-docker.pkg.dev

cd backend
docker buildx build --platform linux/amd64 \
  -t asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/backend:manual-$(date +%s) \
  --push .

cd ../frontend
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=<the staging backend_url from Step 3's output> \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=jobmagnet-6a1ab \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... \
  -t asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/frontend:manual-$(date +%s) \
  --push .
```

**Two things that bit the first real deploy** (2026-09-08, see
`INFRASTRUCTURE.md`'s deploy history for the full story) — both already
handled by the commands above, but worth knowing why:
- `--platform linux/amd64` is required on an arm64 build host (e.g. Apple
  Silicon, Windows on ARM) — Cloud Run rejects anything else. Plain
  `docker build` silently builds for the host's native arch.
- `--push` builds and pushes in one step. Cross-platform buildx output
  generally can't be `--load`ed into the local Docker image store, so
  build-then-separately-push (what you'd normally do) doesn't work here.
- **Always use a fresh tag per deploy** (the `$(date +%s)` above is enough)
  — never reapply under a tag Terraform has already seen in state, even if
  you've since fixed and re-pushed the image behind it. Terraform/Cloud Run
  compare the `image` field as a string, not a resolved digest, so a fix
  under an already-applied tag is invisible to the next `plan`.

(The frontend build needs the backend's URL *before* it can build, and the
backend's `CORS_ORIGIN` needs the frontend's URL — apply staging once with
placeholders first to get real `*.run.app` URLs out of Step 3's outputs,
then rebuild the frontend image with the real backend URL baked in.)

## Step 3 — Apply staging

```bash
cd infra/terraform/environments/staging
terraform init
terraform plan
terraform apply
# once you have real images from Step 2:
terraform apply \
  -var="backend_image=asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/backend:manual-<timestamp>" \
  -var="frontend_image=asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/frontend:manual-<timestamp>"
```

Creates: the backend + frontend Cloud Run services (public, scale-to-zero),
their own runtime service accounts, and **empty** Secret Manager secret
containers for everything in `variables.tf`'s `enabled_secrets` list. The
backend service will crash-loop until Step 4 populates those secrets — that
failure is expected and not a bug in the Terraform.

## Step 4 — Populate secret values

Terraform never touches secret *values* (see
`modules/secret-manager-secret/main.tf`'s comment for why) — add each one by
hand:

```bash
echo -n "<the real Neon staging branch connection string>" | \
  gcloud secrets versions add jobmagnate-staging-database-url --project jobmagnet-6a1ab --data-file=-

echo -n "$(node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))')" | \
  gcloud secrets versions add jobmagnate-staging-jwt-secret --project jobmagnet-6a1ab --data-file=-

echo -n "$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" | \
  gcloud secrets versions add jobmagnate-staging-settings-encryption-key --project jobmagnet-6a1ab --data-file=-

# and one per enabled LLM/job-aggregator key, e.g.:
echo -n "<your real Gemini key>" | \
  gcloud secrets versions add jobmagnate-staging-gemini-api-key --project jobmagnet-6a1ab --data-file=-
```

Run `terraform output provisioned_secret_ids` to see the full list for this
environment. Redeploy the backend Cloud Run revision after populating (or
just wait for the next `terraform apply`/deploy — Cloud Run reads secrets
fresh on each new revision).

**Getting a staging Neon branch**: `neon branches create --project-id
polished-unit-87797764 --name staging --parent production` (or via the
Neon console), then `neon connection-string staging --project-id
polished-unit-87797764` for the value above.

## Step 5 — Verify

```bash
curl https://<backend_url from terraform output>/health
```

Should return `{"status":"ok",...}`. Open `<frontend_url>` in a browser and
confirm the login page renders (same check done manually for local dev
earlier — Google sign-in button present only if the Firebase build-args
were set).

## Tearing down

This creates real, billed resources. If you're just validating the shape
and want to stop paying for it:

```bash
cd infra/terraform/environments/staging && terraform destroy
cd ../../bootstrap && terraform destroy   # only if abandoning this entirely — also deletes the state bucket
```

## Gotchas hit on the real first apply (2026-09-08)

- **The backend service failed to create the first time**, exactly as
  predicted above (secrets existed but had zero versions) — but Cloud Run
  fails the *service creation itself*, not a crash-loop after the fact. The
  error names exactly which `env[N].value_from.secret_key_ref` couldn't
  resolve. This left the service resource **tainted** in Terraform state.
- **A tainted resource + Cloud Run's `deletion_protection` (defaults to
  `true` in google provider v6) combine badly**: Terraform's normal
  "replace a tainted resource" path tries to destroy-then-recreate, but the
  destroy is refused by deletion_protection, and you can't fix the
  attribute via the same plan since a forced replace never gets to the
  "apply the new value" step. Fix: `terraform untaint
  module.<service>.google_cloud_run_v2_service.this` first — that turns
  the next plan into a normal in-place update (deletion_protection is not
  a ForceNew attribute), which both flips the flag and fixes the real
  problem (now-resolvable secrets) in one apply. `modules/cloud-run-service`
  now sets `deletion_protection = false` explicitly rather than relying on
  the provider default, so a fresh apply shouldn't hit this at all —
  this note is for if a *different* resource ends up tainted later.
- **An `enabled_secrets` entry with no real value behind it** (we had
  `GROQ_API_KEY` in the list before realizing local dev's own `.env` has it
  blank) — don't populate it with an empty string; remove it from the list
  instead so the app correctly sees that provider as absent. Terraform then
  destroys the now-unwanted empty secret container on the next apply.

## What's deliberately NOT here yet

- **Production environment** — copy `environments/staging/` once staging is
  verified; Phase F in the plan doc.
- **`cloud-run-job` / `cloud-scheduler-job` modules** — the migration-safety
  and discovery-cron rework is Phase E, sequenced *after* the basic deploy
  pipeline works, not before. Building those modules now would be dead code
  with nothing to configure them against yet.
- **Custom domain mapping** (`jobmagnate.com`) — straightforward to add to
  `modules/cloud-run-service` (`google_cloud_run_domain_mapping`) once
  there's a domain to verify ownership of; not needed to prove staging works.
- **GitHub Actions workflows** — Phases B/C/D. This bootstrap already sets
  up the WIF trust they'll need (`terraform output workload_identity_provider`
  from the bootstrap dir), so that part won't need redoing.
