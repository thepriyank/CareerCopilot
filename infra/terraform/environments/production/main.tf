# Production environment. Mirrors environments/staging/main.tf exactly in
# shape — same modules, same pattern — deliberately, so the two stay easy
# to compare. Only the values differ: production's own runtime SAs, own
# secrets (never shared with staging), and the existing Neon `production`
# branch (already the project default) rather than a child branch.
#
# EXCEPTION (2026-09-22 product decision): the background Cloud Run Jobs +
# Cloud Scheduler triggers staging defines — discovery_job, job_cleanup_job,
# link_check_job, and (added same day) pass_expiry_job — are deliberately
# NOT mirrored here, and none of the four should be added to this file
# without a new, explicit decision to do so. Reasoning specific to
# link_check_job and pass_expiry_job: both are new, still-settling
# background jobs (one repeatedly scans/writes the job pool, the other
# reads every PREMIUM user's planExpiresAt and writes Notification rows)
# — staging is the lower-stakes environment to run either on, so a bug or
# runaway behavior stays off production entirely rather than adding load
# or risk to what real users hit. If discovery/cleanup ever get added here
# too, treat link_check_job and pass_expiry_job as excluded on their own
# merits, not swept in by "mirror staging" — see
# infra/terraform/INFRASTRUCTURE.md's "Daily link-health check" section.

data "google_project" "current" {
  project_id = var.project_id
}

data "google_storage_bucket" "resumes" {
  name = var.existing_gcs_bucket_name
}

module "frontend_sa" {
  source        = "../../modules/service-account"
  project_id    = var.project_id
  account_id    = "jobmagnate-fe-${var.environment}"
  display_name  = "Jobmagnate frontend runtime (${var.environment})"
  project_roles = []
}

module "backend_sa" {
  source        = "../../modules/service-account"
  project_id    = var.project_id
  account_id    = "jobmagnate-be-${var.environment}"
  display_name  = "Jobmagnate backend runtime (${var.environment})"
  project_roles = []
}

resource "google_storage_bucket_iam_member" "backend_can_use_resume_bucket" {
  bucket = data.google_storage_bucket.resumes.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${module.backend_sa.email}"
}

locals {
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
}

module "backend_service" {
  source                = "../../modules/cloud-run-service"
  project_id            = var.project_id
  region                = var.region
  service_name          = "jobmagnate-backend-${var.environment}"
  image                 = var.backend_image
  service_account_email = module.backend_sa.email
  # Same Phase-E caveat as staging (docs/cicd_terraform_plan.md §6/§8):
  # index.ts still runs migrations + the discovery cron on boot. Capped
  # at 1 for the same reason — matters even more here than in staging.
  min_instances         = 0
  max_instances         = 1
  allow_unauthenticated = true
  labels                = { app = "jobmagnate", environment = var.environment, service = "backend" }

  env_vars = {
    NODE_ENV                        = "production"
    CORS_ORIGIN                     = "${module.frontend_service.url},https://${var.custom_domain}"
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
    JOB_DISCOVERY_CRON_ENABLED      = "false"
  }

  secret_env_vars = { for k, m in module.secrets : k => m.secret_id }
}

# Maps the apex domain to the frontend service. Requires var.custom_domain to
# already be verified in Google Search Console (https://search.google.com/search-console)
# for a principal that also has Owner/Editor on this project — critically,
# that verification must extend to whichever principal actually calls this
# API. When Terraform runs as jobmagnate-deployer (GitHub Actions via WIF,
# same as every other apply in this environment), the *service account* also
# needs to be added as a verified owner on the Search Console property
# (Settings -> Users and permissions -> Add owner -> the SA's email) — a
# human verifying it under their own Google account is not, by itself,
# enough for a service-account-driven apply to succeed. Skipping this step
# fails the apply with a "domain is not verified" error, not a Terraform bug.
resource "google_cloud_run_domain_mapping" "frontend" {
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = module.frontend_service.name
  }
}

# Maps api.<custom_domain> to the backend service. Added 2026-09-21 — the
# Chrome extension shipped hardcoded to https://api.jobmagnate.com before
# this mapping ever existed, which had no DNS record at all and would have
# broken every real install; the extension was repointed at the backend's
# raw Cloud Run URL as an immediate fix (see extension/CHROMEWEBSTORE.md),
# with this mapping as the proper follow-up. Same Search Console
# verification caveat as the frontend mapping above applies — a
# Domain-type (not URL-prefix) verified property for var.custom_domain
# should already cover this subdomain automatically.
resource "google_cloud_run_domain_mapping" "backend" {
  location = var.region
  name     = "api.${var.custom_domain}"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = module.backend_service.name
  }
}

# Maps www.<custom_domain> to the frontend service — only so it can redirect.
# frontend/src/middleware.ts answers every www request with a 308 to the apex
# (path + query kept); serving the app on both hosts would split sign-in
# sessions, PWA installs and SEO across two origins. Added 2026-09-23: before
# this, www had GoDaddy's default CNAME -> apex, which reached Google's
# frontends with no mapping/cert for the host, so TLS failed outright. Same
# Search Console verification as the mappings above (Domain property covers
# subdomains). DNS: CNAME www -> ghs.googlehosted.com (see output below).
resource "google_cloud_run_domain_mapping" "frontend_www" {
  location = var.region
  name     = "www.${var.custom_domain}"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = module.frontend_service.name
  }
}
