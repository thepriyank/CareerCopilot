variable "project_id" {
  type    = string
  default = "jobmagnet-6a1ab"
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "environment" {
  description = "Short environment name, used in resource names and secret ids."
  type        = string
  default     = "staging"
}

variable "backend_image" {
  description = "Full backend image reference (Artifact Registry). Empty default deploys Cloud Run's public 'hello' placeholder image on the very first `apply`, before any real image has been pushed — see README.md's bootstrap-order note. Override via -var once a real image exists."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_image" {
  description = "Full frontend image reference (Artifact Registry). Same placeholder-default reasoning as backend_image."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "existing_gcs_bucket_name" {
  description = "The already-existing résumé-storage GCS bucket (created manually, not by this Terraform — see ARCHITECTURE.md §7). The backend runtime SA gets objectAdmin scoped to just this bucket."
  type        = string
  default     = "jobmagnet-user-data"
}

variable "firebase_project_id" {
  type    = string
  default = "jobmagnet-6a1ab"
}

variable "enabled_secrets" {
  description = "Which of the backend's optional secrets to actually provision in this environment (see locals.all_secrets in main.tf for the full catalog). Matches the app's own 'absent = feature/provider skipped' design — add an entry here once you actually have that credential, then populate its value via gcloud (see README.md), don't provision empty secrets nothing will ever fill."
  type        = list(string)
  default = [
    "DATABASE_URL",
    "JWT_SECRET",
    "SETTINGS_ENCRYPTION_KEY",
    # Free-tier LLM providers with a real key in local backend/.env as of
    # 2026-09-08. GROQ_API_KEY is deliberately excluded — it's empty
    # locally too, and an empty-but-present secret would make the app think
    # Groq is configured when it isn't. Add it back once a real key exists.
    # Add DEEPSEEK/ANTHROPIC/OPENAI here too once LLM_ALLOW_PAID is ever
    # turned on for a deployed environment.
    "GEMINI_API_KEY",
    "CEREBRAS_API_KEY",
    "OLLAMA_API_KEY",
    "OPENROUTER_API_KEY",
    # Job aggregator — real free-tier key signed up 2026-09-12, India-scoped
    # (discoverJobsGlobally already queries Adzuna's /jobs/in/ endpoint via
    # providers/adzuna.ts; this was the only missing piece).
    "ADZUNA_APP_ID",
    "ADZUNA_APP_KEY",
  ]
}

variable "llm_provider_order" {
  type    = string
  default = "groq,cerebras,gemini,ollama,openrouter,deepseek,anthropic,openai"
}
