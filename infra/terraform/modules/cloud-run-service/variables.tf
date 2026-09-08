variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_name" {
  type = string
}

variable "image" {
  description = "Full image reference, e.g. \"asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/backend:<tag>\". Terraform does not build or push images — that's the GitHub Actions deploy workflow's job (docs/cicd_terraform_plan.md §4). This variable just points the service at whatever tag was last pushed."
  type        = string
}

variable "service_account_email" {
  type = string
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "env_vars" {
  description = "Plain (non-secret) environment variables."
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Environment variables sourced from Secret Manager. Map of env-var-name => secret_id (in the same project, version \"latest\"). The secret must already have at least one version — see modules/secret-manager-secret's runbook note."
  type        = map(string)
  default     = {}
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "min_instances" {
  description = "0 = scale to zero (cold starts, no idle cost). Keep at 0 for staging; consider 1 for production once cold-start latency matters more than idle cost."
  type        = number
  default     = 0
}

variable "max_instances" {
  type    = number
  default = 3
}

variable "allow_unauthenticated" {
  description = "true = public internet can invoke this service directly (both the frontend and the backend API need this; a Cloud Run Job like the future migration/discovery-cron jobs would not)."
  type        = bool
  default     = true
}

variable "labels" {
  type    = map(string)
  default = {}
}

variable "deletion_protection" {
  description = "google provider v6 defaults google_cloud_run_v2_service to deletion_protection=true. false is right for staging/active iteration; consider true once an environment carries real traffic."
  type        = bool
  default     = false
}
