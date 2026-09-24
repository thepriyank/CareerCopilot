# Staging environment: backend + frontend Cloud Run services, their own
# runtime service accounts, and the backend's Secret Manager secrets.
# See docs/cicd_terraform_plan.md §§1-3 for the design this implements.

data "google_project" "current" {
  project_id = var.project_id
}

# The résumé-storage bucket already exists (created manually, see
# ARCHITECTURE.md §7) — referenced here only to grant the backend runtime SA
# access to it, never to manage the bucket's own lifecycle.
data "google_storage_bucket" "resumes" {
  name = var.existing_gcs_bucket_name
}

# ── Runtime service accounts ────────────────────────────────────────────
# Frontend gets an SA purely so Cloud Run has one to run as — it calls no
# GCP APIs itself and holds no secrets, hence zero project_roles.
module "frontend_sa" {
  source        = "../../modules/service-account"
  project_id    = var.project_id
  account_id    = "jobmagnate-fe-${var.environment}"
  display_name  = "Jobmagnate frontend runtime (${var.environment})"
  project_roles = []
}

module "backend_sa" {
  source       = "../../modules/service-account"
  project_id   = var.project_id
  account_id   = "jobmagnate-be-${var.environment}"
  display_name = "Jobmagnate backend runtime (${var.environment})"
  # No Firebase-specific role: firebase-admin's verifyIdToken() checks the
  # JWT locally against Google's public certs — it makes no authenticated
  # GCP API call, so no IAM grant is needed for that alone.
  project_roles = []
}

resource "google_storage_bucket_iam_member" "backend_can_use_resume_bucket" {
  bucket = data.google_storage_bucket.resumes.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${module.backend_sa.email}"
}

# ── Secrets ──────────────────────────────────────────────────────────────
locals {
  # Full catalog: env var name => secret-id suffix. Only the subset in
  # var.enabled_secrets is actually created — see that variable's comment.
  all_secrets = {
    DATABASE_URL                   = "database-url"
    JWT_SECRET                     = "jwt-secret"
    SETTINGS_ENCRYPTION_KEY        = "settings-encryption-key"
    GEMINI_API_KEY                 = "gemini-api-key"
    GROQ_API_KEY                   = "groq-api-key"
    OLLAMA_API_KEY                 = "ollama-api-key"
    OPENROUTER_API_KEY             = "openrouter-api-key"
    DEEPSEEK_API_KEY               = "deepseek-api-key"
    ANTHROPIC_API_KEY              = "anthropic-api-key"
    OPENAI_API_KEY                 = "openai-api-key"
    THEIRSTACK_API_KEY             = "theirstack-api-key"
    ADZUNA_APP_ID                  = "adzuna-app-id"
    ADZUNA_APP_KEY                 = "adzuna-app-key"
    JOOBLE_API_KEY                 = "jooble-api-key"
    JSEARCH_RAPID_API_KEY          = "jsearch-rapid-api-key"
    JSEARCH_OPEN_WEB_NINJA_API_KEY = "jsearch-open-web-ninja-api-key"
    SLACK_ALERTS_WEBHOOK_URL       = "slack-alerts-webhook"
    # Shared secret for POST /api/internal/jobs/ingest — the local JobSpy
    # scraper (scripts/jobspy-ingest/) authenticates with this. Added
    # 2026-09-17 to let that script target the shared staging pool instead
    # of only local dev (its .env's BACKEND_INGEST_URL defaults to
    # localhost) — was never wired into any deployed environment before.
    INTERNAL_INGEST_TOKEN = "internal-ingest-token"
    # Phase B billing (2026-09-19) — see routes/payments.routes.ts.
    RAZORPAY_KEY_ID         = "razorpay-key-id"
    RAZORPAY_KEY_SECRET     = "razorpay-key-secret"
    RAZORPAY_WEBHOOK_SECRET = "razorpay-webhook-secret"
  }

  enabled_secret_map = { for k, v in local.all_secrets : k => v if contains(var.enabled_secrets, k) }
}

module "secrets" {
  source     = "../../modules/secret-manager-secret"
  for_each   = local.enabled_secret_map
  project_id = var.project_id
  secret_id  = "jobmagnate-${var.environment}-${each.value}"

  accessor_service_account_emails = [module.backend_sa.email]
  labels = {
    app         = "jobmagnate"
    environment = var.environment
  }
}

# ── Cloud Run services ──────────────────────────────────────────────────
module "frontend_service" {
  source                = "../../modules/cloud-run-service"
  project_id            = var.project_id
  region                = var.region
  service_name          = "jobmagnate-frontend-${var.environment}"
  image                 = var.frontend_image
  service_account_email = module.frontend_sa.email
  min_instances         = 0
  max_instances         = 3
  allow_unauthenticated = true
  labels                = { app = "jobmagnate", environment = var.environment, service = "frontend" }
  # NEXT_PUBLIC_* values are baked in at image build time (see
  # frontend/Dockerfile) — nothing to set here at deploy time.
}

module "backend_service" {
  source                = "../../modules/cloud-run-service"
  project_id            = var.project_id
  region                = var.region
  service_name          = "jobmagnate-backend-${var.environment}"
  image                 = var.backend_image
  service_account_email = module.backend_sa.email
  # Capped at 1 instance: index.ts still runs migrations + the discovery
  # cron on every boot (Phase E hasn't landed yet, see
  # docs/cicd_terraform_plan.md §6/§8) — this doesn't eliminate the
  # multi-instance race during a rolling deploy, but it removes the
  # steady-state duplicate-instance version of the hazard until Phase E's
  # real fix (a dedicated migration Job + advisory lock) lands.
  min_instances         = 0
  max_instances         = 1
  allow_unauthenticated = true
  labels                = { app = "jobmagnate", environment = var.environment, service = "backend" }

  env_vars = {
    NODE_ENV                        = "production"
    CORS_ORIGIN                     = module.frontend_service.url
    JWT_EXPIRES_IN                  = "7d"
    FIREBASE_PROJECT_ID             = var.firebase_project_id
    GCS_BUCKET_NAME                 = var.existing_gcs_bucket_name
    GCS_PROJECT_ID                  = var.project_id
    LLM_PROVIDER_ORDER              = var.llm_provider_order
    LLM_ALLOW_PAID                  = "false"
    LLM_COOLDOWN_MS                 = "900000"
    JOB_MATCH_MIN_SCORE             = "38"
    JOB_MATCH_MAX_LISTINGS_TO_SCORE = "500"
    UPLOAD_DIR                      = "uploads"
    MAX_FILE_SIZE                   = "10485760"
    # Stays off until Phase E replaces the in-process node-cron with Cloud
    # Scheduler + a dedicated Cloud Run Job — turning this on today would
    # re-run discovery on every cold start with no cross-instance guard.
    JOB_DISCOVERY_CRON_ENABLED = "false"
  }

  secret_env_vars = { for k, m in module.secrets : k => m.secret_id }
}

# ── Daily job discovery (Phase E fix, 2026-09-09) ───────────────────────
# Replaces reliance on backend_service's in-process node-cron
# (discoveryCron.ts), which never fires reliably on Cloud Run: a tick that
# lands while the instance is scaled to zero (min_instances=0 here) simply
# never runs. This Cloud Run Job — same image as the backend, entrypoint
# overridden to `node dist/scripts/runDiscovery.js` — is invoked directly by
# Cloud Scheduler instead, giving genuine once-a-day execution semantics
# with no always-on process required. JOB_DISCOVERY_CRON_ENABLED stays
# "false" on the web service (see backend_service.env_vars above) — this
# Job is now the only path that runs discovery.
module "discovery_scheduler_sa" {
  source        = "../../modules/service-account"
  project_id    = var.project_id
  account_id    = "jobmagnate-disc-sched-${var.environment}"
  display_name  = "Jobmagnate discovery-job invoker (${var.environment}) — Cloud Scheduler only, no runtime DB/secret access"
  project_roles = []
}

module "discovery_job" {
  source     = "../../modules/cloud-run-job"
  project_id = var.project_id
  region     = var.region
  job_name   = "jobmagnate-discovery-${var.environment}"
  image      = var.backend_image
  # Same runtime SA as the backend service — it already holds the Secret
  # Manager grants this job needs (DATABASE_URL, LLM provider keys).
  service_account_email = module.backend_sa.email
  command               = ["node"]
  args                  = ["dist/scripts/runDiscovery.js"]
  labels                = { app = "jobmagnate", environment = var.environment, service = "discovery-job" }

  env_vars = {
    NODE_ENV           = "production"
    LLM_PROVIDER_ORDER = var.llm_provider_order
    LLM_ALLOW_PAID     = "false"
    LLM_COOLDOWN_MS    = "900000"
  }

  # Reuses the exact same secret set as backend_service (including
  # JWT_SECRET/SETTINGS_ENCRYPTION_KEY, which this job never reads) rather
  # than maintaining a second, narrower list — the runtime SA already has
  # access to all of them either way, so there's no privilege gained by
  # subsetting, only a second list to keep in sync.
  secret_env_vars = { for k, m in module.secrets : k => m.secret_id }
}

module "discovery_schedule" {
  source                        = "../../modules/cloud-scheduler-job"
  project_id                    = var.project_id
  region                        = var.region
  name                          = "jobmagnate-discovery-${var.environment}"
  schedule                      = "30 1 * * *" # 1:30 UTC = 7:00am IST, once daily
  time_zone                     = "Etc/UTC"
  cloud_run_job_name            = module.discovery_job.name
  invoker_service_account_email = module.discovery_scheduler_sa.email
}

# ── Weekly job-listing cleanup (Phase 2 staleness/expiry, 2026-09-17) ────
# Same Cloud Run Job + Cloud Scheduler pattern as discovery above — see
# backend/src/services/jobs/jobCleanup.ts for the actual rules (a listing
# is marked EXPIRED once it's been in the pool >= STALE_AFTER_DAYS, by the
# daily discovery_job above; this weekly job hard-deletes anything that's
# stayed EXPIRED for >= PURGE_AFTER_EXPIRED_DAYS). Cloud Scheduler has no
# native "start on this date" option, so "starts 2026-12-01" is enforced in
# code (jobCleanup.ts's CLEANUP_STARTS_AT) rather than here — every weekly
# tick before that date is a deliberate, logged no-op, so this can be
# applied now without anyone needing to touch Terraform again in December.
module "job_cleanup_scheduler_sa" {
  source        = "../../modules/service-account"
  project_id    = var.project_id
  account_id    = "jobmagnate-clean-sched-${var.environment}" # google_service_account account_id caps at 30 chars
  display_name  = "Jobmagnate cleanup-job invoker (${var.environment}) — Cloud Scheduler only, no runtime DB/secret access"
  project_roles = []
}

module "job_cleanup_job" {
  source     = "../../modules/cloud-run-job"
  project_id = var.project_id
  region     = var.region
  job_name   = "jobmagnate-job-cleanup-${var.environment}"
  image      = var.backend_image
  # Same runtime SA as the backend service/discovery job — already holds
  # the Secret Manager grants this job needs (just DATABASE_URL, really).
  service_account_email = module.backend_sa.email
  command               = ["node"]
  args                  = ["dist/scripts/runJobCleanup.js"]
  labels                = { app = "jobmagnate", environment = var.environment, service = "job-cleanup-job" }

  env_vars = {
    NODE_ENV = "production"
  }

  # Reuses the full secret set for the same reason discovery_job does —
  # see that module's comment.
  secret_env_vars = { for k, m in module.secrets : k => m.secret_id }
}

module "job_cleanup_schedule" {
  source                        = "../../modules/cloud-scheduler-job"
  project_id                    = var.project_id
  region                        = var.region
  name                          = "jobmagnate-job-cleanup-${var.environment}"
  schedule                      = "0 2 * * 2" # 2:00 UTC every Tuesday = 7:30am IST; 2026-12-01 is itself a Tuesday
  time_zone                     = "Etc/UTC"
  cloud_run_job_name            = module.job_cleanup_job.name
  invoker_service_account_email = module.job_cleanup_scheduler_sa.email
}

# ── Daily link-health check (2026-09-22, Jira NM-26) ─────────────────────
# Same Cloud Run Job + Cloud Scheduler pattern as discovery/job_cleanup
# above — see backend/src/services/jobs/linkHealthCheck.ts for the actual
# rules (a bounded batch of ACTIVE listings gets its own posting URL
# checked, oldest/never-checked first; a confirmed-dead one — or one that's
# failed ambiguously on 2 separate runs — gets marked EXPIRED, same status
# the age-based staleness path above already uses). Scheduled after
# discovery (1:30 UTC) so a freshly-discovered listing has already landed
# in the pool before its first link check, though the ordering isn't load-
# bearing — the two jobs don't share any state.
#
# STAGING-ONLY BY DELIBERATE DESIGN — do not copy this block (or the two
# modules below it) into environments/production/main.tf as part of a
# routine "keep production mirrored with staging" pass. See that file's
# own top-of-file comment for the explicit exception and reasoning
# (staging is the lower-stakes environment for a still-settling background
# job that repeatedly scans/writes the job pool). Re-adding it there needs
# its own new decision, not an automatic sync.
module "link_check_scheduler_sa" {
  source        = "../../modules/service-account"
  project_id    = var.project_id
  account_id    = "jobmagnate-link-sched-${var.environment}" # google_service_account account_id caps at 30 chars
  display_name  = "Jobmagnate link-check-job invoker (${var.environment}) — Cloud Scheduler only, no runtime DB/secret access"
  project_roles = []
}

module "link_check_job" {
  source     = "../../modules/cloud-run-job"
  project_id = var.project_id
  region     = var.region
  job_name   = "jobmagnate-link-check-${var.environment}"
  image      = var.backend_image
  # Same runtime SA as the backend service/discovery job — already holds
  # the Secret Manager grants this job needs (just DATABASE_URL, really).
  service_account_email = module.backend_sa.email
  command               = ["node"]
  args                  = ["dist/scripts/runLinkCheck.js"]
  labels                = { app = "jobmagnate", environment = var.environment, service = "link-check-job" }

  env_vars = {
    NODE_ENV = "production"
  }

  # Reuses the full secret set for the same reason discovery_job does —
  # see that module's comment.
  secret_env_vars = { for k, m in module.secrets : k => m.secret_id }
}

module "link_check_schedule" {
  source                        = "../../modules/cloud-scheduler-job"
  project_id                    = var.project_id
  region                        = var.region
  name                          = "jobmagnate-link-check-${var.environment}"
  schedule                      = "0 3 * * *" # 3:00 UTC = 8:30am IST, once daily
  time_zone                     = "Etc/UTC"
  cloud_run_job_name            = module.link_check_job.name
  invoker_service_account_email = module.link_check_scheduler_sa.email
}

# ── Daily pass-expiry notification check (2026-09-22) ────────────────────
# Same Cloud Run Job + Cloud Scheduler pattern as the jobs above — see
# backend/src/services/notifications/passExpiryNotifier.ts for the rule
# (warn a PREMIUM user once, 3 days before planExpiresAt). Scheduled after
# discovery/link-check so it doesn't compete with them for the same
# min_instances=0 cold-start window, though nothing here shares state with
# either.
#
# STAGING-ONLY BY DELIBERATE DESIGN, same reasoning as link_check_job
# above — a still-settling background job stays off production until it's
# proven out. Do not copy into environments/production/main.tf as part of
# a routine "keep production mirrored" pass; see that file's own
# top-of-file comment.
module "pass_expiry_scheduler_sa" {
  source        = "../../modules/service-account"
  project_id    = var.project_id
  account_id    = "jobmagnate-exp-sched-${var.environment}" # google_service_account account_id caps at 30 chars
  display_name  = "Jobmagnate pass-expiry-job invoker (${var.environment}) — Cloud Scheduler only, no runtime DB/secret access"
  project_roles = []
}

module "pass_expiry_job" {
  source     = "../../modules/cloud-run-job"
  project_id = var.project_id
  region     = var.region
  job_name   = "jobmagnate-pass-expiry-${var.environment}"
  image      = var.backend_image
  # Same runtime SA as the backend service/discovery job — already holds
  # the Secret Manager grants this job needs (just DATABASE_URL, really).
  service_account_email = module.backend_sa.email
  command               = ["node"]
  args                  = ["dist/scripts/runPassExpiryCheck.js"]
  labels                = { app = "jobmagnate", environment = var.environment, service = "pass-expiry-job" }

  env_vars = {
    NODE_ENV = "production"
  }

  # Reuses the full secret set for the same reason discovery_job does —
  # see that module's comment.
  secret_env_vars = { for k, m in module.secrets : k => m.secret_id }
}

module "pass_expiry_schedule" {
  source                        = "../../modules/cloud-scheduler-job"
  project_id                    = var.project_id
  region                        = var.region
  name                          = "jobmagnate-pass-expiry-${var.environment}"
  schedule                      = "0 4 * * *" # 4:00 UTC = 9:30am IST, once daily
  time_zone                     = "Etc/UTC"
  cloud_run_job_name            = module.pass_expiry_job.name
  invoker_service_account_email = module.pass_expiry_scheduler_sa.email
}
