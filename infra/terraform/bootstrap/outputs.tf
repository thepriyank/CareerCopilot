output "tfstate_bucket" {
  description = "GCS bucket name for environment Terraform state — used as the `bucket` value in each environment's backend.tf."
  value       = google_storage_bucket.tfstate.name
}

output "artifact_registry_repo_url" {
  description = "Docker repo URL prefix — images push to <this>/<image-name>:<tag>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "deployer_service_account_email" {
  description = "Service account GitHub Actions impersonates via WIF."
  value       = google_service_account.deployer.email
}

output "workload_identity_provider" {
  description = "Full WIF provider resource name — this is the `workload_identity_provider` input for google-github-actions/auth in every GitHub Actions workflow."
  value       = google_iam_workload_identity_pool_provider.github.name
}
