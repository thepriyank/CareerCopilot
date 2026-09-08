output "url" {
  description = "Auto-generated *.run.app URL. Map a custom domain (google_cloud_run_domain_mapping, not yet added — see docs/cicd_terraform_plan.md §1) for a stable address instead of depending on this one."
  value       = google_cloud_run_v2_service.this.uri
}

output "name" {
  value = google_cloud_run_v2_service.this.name
}
