# Triggers a Cloud Run v2 Job execution on a schedule, via the Cloud Run
# Jobs REST API (POST .../jobs/<name>:run) authenticated as a dedicated
# invoker service account — not the job's own runtime SA. Google's
# documented endpoint shape for this is the v1 namespace path even though
# the Job resource itself is a v2 resource elsewhere; that's not a typo.
#
# NOTE: worth a manual `gcloud scheduler jobs run <name>` (or the "Run now"
# button in the Cloud Scheduler console) after the first apply, to confirm
# the invocation actually reaches the job before trusting the schedule —
# this module's `terraform plan`/`apply` can validate the resources exist
# and are wired together, but not that Cloud Scheduler's HTTP call to
# run.googleapis.com actually succeeds end-to-end.

resource "google_cloud_run_v2_job_iam_member" "scheduler_can_invoke" {
  project  = var.project_id
  location = var.region
  name     = var.cloud_run_job_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.invoker_service_account_email}"
}

resource "google_cloud_scheduler_job" "this" {
  project   = var.project_id
  region    = var.region
  name      = var.name
  schedule  = var.schedule
  time_zone = var.time_zone

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${var.cloud_run_job_name}:run"

    oauth_token {
      service_account_email = var.invoker_service_account_email
    }
  }

  depends_on = [google_cloud_run_v2_job_iam_member.scheduler_can_invoke]
}
