# Generic Cloud Run v2 service — used for both the backend API and the
# frontend (see docs/cicd_terraform_plan.md §1: same module, different
# images/env/secrets per environments/*/main.tf caller).
#
# Deliberately does NOT set a `PORT` env var: Cloud Run injects its own and
# both images already honor process.env.PORT (backend: config/index.ts;
# frontend: the Next.js standalone server.js) — see each Dockerfile.

resource "google_cloud_run_v2_service" "this" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = var.labels

  # google provider v6 defaults this to true, blocking `terraform destroy`
  # (and blocking a replace of a tainted/failed resource, which is how this
  # was found — see docs/cicd_terraform_plan.md's Phase A notes). Fine to
  # leave off while actively iterating; consider turning on for production
  # once it's carrying real traffic and an accidental destroy would matter.
  deletion_protection = var.deletion_protection

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      ports {
        container_port = var.container_port
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

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # KNOWN COSMETIC DIFF (confirmed live 2026-09-08, google provider
  # v6.50.0): every `terraform plan` for this resource shows
  # `scaling.manual_instance_count = 0 -> null` even immediately after a
  # clean apply — the Cloud Run v2 API always echoes back
  # manualInstanceCount for a service in automatic-scaling mode, which this
  # module never sets. Applying it is a fast, no-downtime metadata PATCH
  # with no effect on the running service (min/max instance counts are
  # unaffected) — it just never converges to a truly empty diff. Tried
  # `lifecycle { ignore_changes = [...] }` targeting this field; the
  # provider's schema doesn't expose it as an ignorable attribute path
  # from a config that never sets it ("Unsupported attribute"). Treat "2
  # to change" showing only this field as expected noise, not a real
  # signal — see infra/terraform/INFRASTRUCTURE.md.

  # The Cloud Run service itself doesn't hold the secret's IAM grant — the
  # runtime SA does (see modules/secret-manager-secret's accessor binding,
  # wired up by whichever environment/*/main.tf passes that SA's email in
  # here as service_account_email). No secret-specific IAM resource lives
  # in this module.
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = google_cloud_run_v2_service.this.location
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
