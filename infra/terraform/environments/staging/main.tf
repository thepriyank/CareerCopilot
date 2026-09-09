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
    CEREBRAS_API_KEY               = "cerebras-api-key"
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
    JOB_MATCH_MIN_SCORE             = "32"
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
