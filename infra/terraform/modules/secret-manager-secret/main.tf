# Creates an EMPTY Secret Manager secret container and grants one service
# account read access to it. Deliberately does NOT create a
# google_secret_manager_secret_version — secret VALUES never pass through
# Terraform (plan/apply output, state file, or a tfvars file). A human (or a
# separate, narrowly-scoped script) populates the actual value afterward:
#
#   echo -n "the-real-value" | gcloud secrets versions add <secret_id> \
#     --project <project_id> --data-file=-
#
# A Cloud Run service referencing a secret with zero versions fails to
# deploy — populate values BEFORE the first `terraform apply` of a Cloud Run
# service that references them. See infra/terraform/README.md's runbook.

resource "google_secret_manager_secret" "this" {
  project   = var.project_id
  secret_id = var.secret_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each  = toset(var.accessor_service_account_emails)
  project   = var.project_id
  secret_id = google_secret_manager_secret.this.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value}"
}
