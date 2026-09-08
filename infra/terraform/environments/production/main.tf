# Production environment. Mirrors environments/staging/main.tf exactly in
# shape — same modules, same pattern — deliberately, so the two stay easy
# to compare. Only the values differ: production's own runtime SAs, own
# secrets (never shared with staging), and the existing Neon `production`
# branch (already the project default) rather than a child branch.

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
    JOB_DISCOVERY_CRON_ENABLED      = "false"
  }

  secret_env_vars = { for k, m in module.secrets : k => m.secret_id }
}
