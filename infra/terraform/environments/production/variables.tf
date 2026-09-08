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
    "CEREBRAS_API_KEY",
    "OLLAMA_API_KEY",
    "OPENROUTER_API_KEY",
  ]
}

variable "llm_provider_order" {
  # Matches staging's default exactly, including "groq" first even though
  # it's not in enabled_secrets above — harmless, the app's provider chain
  # skips any provider with no configured key regardless of list position.
  # Kept identical to staging rather than silently drifting.
  type    = string
  default = "groq,cerebras,gemini,ollama,openrouter,deepseek,anthropic,openai"
}
