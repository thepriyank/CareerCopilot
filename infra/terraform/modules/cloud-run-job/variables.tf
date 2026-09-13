variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "job_name" {
  type = string
}

variable "image" {
  description = "Same image reference as the backend Cloud Run service (see environments/*/image_tags.tfvars) — this Job overrides the container's entrypoint via command/args rather than needing its own image."
  type        = string
}

variable "command" {
  type    = list(string)
  default = null
}

variable "args" {
  type    = list(string)
  default = null
}

variable "service_account_email" {
  description = "Runtime identity for the job's own DB/secret access — typically the same backend runtime SA used by the Cloud Run service, since it already has the needed Secret Manager grants."
  type        = string
}

variable "env_vars" {
  type    = map(string)
  default = {}
}

variable "secret_env_vars" {
  type    = map(string)
  default = {}
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "max_retries" {
  description = "Cloud Run Job's own retry count for a failed execution attempt. Kept low — a discovery run failure is logged and safe to just wait for tomorrow's tick rather than hammer rate-limited free-tier job APIs with retries."
  type        = number
  default     = 1
}

variable "timeout_seconds" {
  description = "Max wall-clock time for one execution before Cloud Run kills it. Discovery calls ~10 provider APIs sequentially plus per-listing LLM skill extraction for new listings only — generous headroom."
  type        = number
  default     = 900
}

variable "labels" {
  type    = map(string)
  default = {}
}
