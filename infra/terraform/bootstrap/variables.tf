variable "project_id" {
  description = "GCP project everything deploys into (backend + frontend Cloud Run, GCS, Firebase all share this one project — see docs/cicd_terraform_plan.md's 'GCP project scope' decision)."
  type        = string
  default     = "jobmagnet-6a1ab"
}

variable "region" {
  description = "Primary GCP region. asia-southeast1 (Singapore) is chosen to sit next to Neon's aws-ap-southeast-1 (also Singapore) branch, minimizing backend<->DB latency."
  type        = string
  default     = "asia-southeast1"
}

variable "github_repo" {
  description = "GitHub repo (owner/name) allowed to assume the deployer service account via Workload Identity Federation. Confirmed via `git remote -v` on 2026-09-08 — the app was renamed to Jobmagnate but the GitHub repo itself was not."
  type        = string
  default     = "thepriyank/CareerCopilot"
}

variable "state_bucket_name" {
  description = "Globally-unique GCS bucket name for Terraform remote state (all environments, distinct object-key prefixes per environment)."
  type        = string
  default     = "jobmagnet-6a1ab-tfstate"
}

variable "artifact_registry_repo_id" {
  description = "Artifact Registry Docker repository id, shared by both the backend and frontend images (distinguished by image name, not by repo)."
  type        = string
  default     = "jobmagnate"
}

variable "deployer_service_account_id" {
  description = "Service account id (before @project.iam...) that GitHub Actions impersonates via WIF to run terraform apply / gcloud deploy commands."
  type        = string
  default     = "jobmagnate-deployer"
}

variable "existing_gcs_bucket_name" {
  description = "The already-existing résumé-storage bucket (see ARCHITECTURE.md §7) — shared across every environment, not environment-scoped, so the deployer's IAM grant on it lives here rather than being duplicated per environment/main.tf."
  type        = string
  default     = "jobmagnet-user-data"
}
