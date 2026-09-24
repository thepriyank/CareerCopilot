variable "project_id" {
  type    = string
  default = "jobmagnet-6a1ab"
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "backend_image" {
  description = "See staging/variables.tf's equivalent — same bootstrap-order reasoning applies to the very first apply of this environment."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_image" {
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "existing_gcs_bucket_name" {
  type    = string
  default = "jobmagnet-user-data"
}

variable "firebase_project_id" {
  type    = string
  default = "jobmagnet-6a1ab"
}

variable "enabled_secrets" {
  description = "Same catalog as staging (see main.tf's locals.all_secrets) — kept identical on purpose so both environments stay symmetric. Values are entirely separate Secret Manager secrets/versions, never shared with staging (see README.md's runbook)."
  type        = list(string)
  default = [
    "DATABASE_URL",
    "JWT_SECRET",
    "SETTINGS_ENCRYPTION_KEY",
    "GEMINI_API_KEY",
    "OLLAMA_API_KEY",
    "OPENROUTER_API_KEY",
    # Live Razorpay credentials — account activated 2026-09-21. Real
    # rzp_live_* values populated directly via `gcloud secrets versions
    # add`, never committed to source — NOT staging's rzp_test_* keys.
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    # Free-tier Groq key, enabled 2026-09-23. The secret was created and
    # populated outside Terraform (value never touches state), then adopted
    # with `terraform import 'module.secrets["GROQ_API_KEY"].google_secret_manager_secret.this'
    # projects/jobmagnet-6a1ab/secrets/jobmagnate-production-groq-api-key`.
    "GROQ_API_KEY",
    # NM-29 owner alerts (Slack incoming webhook). Created + populated by the
    # owner outside Terraform on 2026-09-24, then adopted with
    # `terraform import 'module.secrets["SLACK_ALERTS_WEBHOOK_URL"].google_secret_manager_secret.this'
    # projects/jobmagnet-6a1ab/secrets/jobmagnate-production-slack-alerts-webhook`.
    "SLACK_ALERTS_WEBHOOK_URL",
  ]
}

variable "custom_domain" {
  description = "Apex domain to map to the frontend Cloud Run service via google_cloud_run_domain_mapping. Must already be verified in Google Search Console (https://search.google.com/search-console) for an account/service-account that is a Domain owner or Editor on this project, or the mapping resource will fail to create — see main.tf's comment."
  type        = string
  default     = "jobmagnate.com"
}

variable "llm_provider_order" {
  # Matches staging's default exactly. Ollama is last among the free
  # providers on purpose — it's the account topped up with paid credit, so
  # it backstops the genuinely-free ones (see providerRegistry.ts).
  # Kept identical to staging rather than silently drifting.
  type    = string
  default = "groq,gemini,openrouter,ollama,deepseek,anthropic,openai"
}
