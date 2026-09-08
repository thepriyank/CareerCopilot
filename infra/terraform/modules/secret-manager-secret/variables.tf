variable "project_id" {
  type = string
}

variable "secret_id" {
  description = "Secret Manager secret id, e.g. \"jobmagnate-staging-database-url\". Include the environment in the id — secrets are project-scoped, not environment-scoped, and staging/prod must never share one."
  type        = string
}

variable "accessor_service_account_emails" {
  description = "Service accounts granted roles/secretmanager.secretAccessor on this secret — normally just the one Cloud Run runtime SA that needs it."
  type        = list(string)
  default     = []
}

variable "labels" {
  type    = map(string)
  default = {}
}
