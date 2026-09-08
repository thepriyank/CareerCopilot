# Least-privilege runtime service account for one Cloud Run service — see
# docs/cicd_terraform_plan.md §3: each environment/service pair gets its own
# SA, never a shared one, so a compromised staging revision can't touch prod
# secrets or a backend SA's GCS/Firebase rights.

resource "google_service_account" "this" {
  project      = var.project_id
  account_id   = var.account_id
  display_name = var.display_name
}

resource "google_project_iam_member" "roles" {
  for_each = toset(var.project_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.this.email}"
}
