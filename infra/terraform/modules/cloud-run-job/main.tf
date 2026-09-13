# Generic Cloud Run v2 Job — a container that runs to completion and exits,
# rather than an always-on Service. Used for the daily discovery run (see
# docs/cicd_terraform_plan.md's Phase E): the in-process node-cron in
# discoveryCron.ts doesn't survive Cloud Run's scale-to-zero (a tick fired
# while the web service instance is idle never runs), so this Job — same
# image as the backend service, entrypoint overridden to
# `node dist/scripts/runDiscovery.js` — is invoked directly by Cloud
# Scheduler instead (see modules/cloud-scheduler-job). No always-on process
# needed, no missed-tick risk, no duplicate-run risk from multiple
# instances (there's exactly one execution per invocation).

resource "google_cloud_run_v2_job" "this" {
  project  = var.project_id
  name     = var.job_name
  location = var.region
  labels   = var.labels

  template {
    template {
      service_account = var.service_account_email
      max_retries     = var.max_retries
      timeout         = "${var.timeout_seconds}s"

      containers {
        image   = var.image
        command = var.command
        args    = var.args

        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }

        dynamic "env" {
          for_each = var.env_vars
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = var.secret_env_vars
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }
    }
  }
}
