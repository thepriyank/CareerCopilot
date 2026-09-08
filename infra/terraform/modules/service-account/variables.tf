variable "project_id" {
  type = string
}

variable "account_id" {
  description = "SA id (before @project.iam...). Must be <= 30 chars, lowercase alphanumeric + hyphens."
  type        = string
}

variable "display_name" {
  type = string
}

variable "project_roles" {
  description = "Project-level IAM roles granted to this service account. Keep minimal — e.g. a frontend runtime SA typically needs none of these at all (it holds no secrets, calls no GCP APIs itself)."
  type        = list(string)
  default     = []
}
