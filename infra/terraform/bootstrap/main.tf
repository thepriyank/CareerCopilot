# One-time bootstrap: creates the things every environment's Terraform run
# depends on but that can't reasonably live inside those environments
# themselves (the state bucket a remote backend needs to already exist, the
# WIF trust relationship GitHub Actions needs before it can run any other
# Terraform at all). Applied manually, from a developer machine with real
# `gcloud auth application-default login` credentials — see README.md.
# Expected to be touched rarely after the first apply.

locals {
  required_apis = [
    "run.googleapis.com",              # Cloud Run services + jobs
    "artifactregistry.googleapis.com", # Docker image storage
    "secretmanager.googleapis.com",    # app secrets (DB URL, JWT secret, LLM keys, ...)
    "iam.googleapis.com",
    "iamcredentials.googleapis.com", # required for WIF token exchange
    "sts.googleapis.com",            # required for WIF token exchange
    "cloudresourcemanager.googleapis.com",
    "cloudscheduler.googleapis.com", # Phase E: discovery-cron trigger (enabled now so bootstrap doesn't need re-running later)
    "compute.googleapis.com",        # Cloud Run domain mapping / networking touches this
  ]
}

resource "google_project_service" "required" {
  for_each = toset(local.required_apis)
  project  = var.project_id
  service  = each.value

  disable_dependent_services = false
  disable_on_destroy         = false
}

# ── Terraform remote state ──────────────────────────────────────────────
resource "google_storage_bucket" "tfstate" {
  name     = var.state_bucket_name
  project  = var.project_id
  location = var.region

  uniform_bucket_level_access = true
  versioning {
    enabled = true
  }

  # State files hold no secret VALUES (see modules/secret-manager-secret's
  # design — secrets are created empty by Terraform, populated out-of-band),
  # but they do hold resource names/IDs that aren't meant to be public.
  public_access_prevention = "enforced"

  depends_on = [google_project_service.required]
}

# ── Docker images ───────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repo_id
  description   = "Jobmagnate backend + frontend Docker images"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

# ── GitHub Actions → GCP trust (Workload Identity Federation) ──────────
# No long-lived service-account JSON key is ever stored in GitHub Secrets;
# GitHub's own OIDC token is exchanged for short-lived GCP credentials,
# trust-scoped to this one repo.
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions"
  description               = "WIF pool for Jobmagnate's GitHub Actions CI/CD"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  # Required: without an explicit condition, any GitHub repo could
  # theoretically request a token scoped to this pool. Restrict to ours.
  attribute_condition = "assertion.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# ── Deployer service account (what GitHub Actions actually becomes) ────
resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = var.deployer_service_account_id
  display_name = "Jobmagnate CI/CD deployer (impersonated by GitHub Actions via WIF)"
}

resource "google_service_account_iam_member" "wif_can_impersonate_deployer" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# Deployer SA project-level roles. Intentionally NOT roles/editor or
# roles/owner — scoped to exactly what Terraform-apply + image-push +
# Cloud Run deploy need. Tighten further (e.g. move secret access to
# per-secret bindings only) once the environments are stable; see
# docs/cicd_terraform_plan.md §3.
locals {
  deployer_roles = [
    "roles/run.admin",               # deploy/update Cloud Run services + jobs
    "roles/artifactregistry.writer", # push images
    "roles/iam.serviceAccountUser",  # attach runtime SAs to Cloud Run services
    "roles/iam.serviceAccountAdmin", # create the per-environment runtime SAs
    "roles/secretmanager.admin",     # create/manage Secret Manager secrets (not their values — see above)
    "roles/cloudscheduler.admin",    # Phase E: discovery-cron trigger
  ]
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset(local.deployer_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# Deployer needs write access to the state bucket itself (project-level
# storage roles are NOT granted above — scope this to just the one bucket).
resource "google_storage_bucket_iam_member" "deployer_tfstate_access" {
  bucket = google_storage_bucket.tfstate.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.deployer.email}"
}

# environments/*/main.tf reads this bucket (data "google_storage_bucket")
# and manages the backend runtime SA's IAM binding on it — both need
# storage.admin scoped to just this bucket, which nothing above grants
# (deployer intentionally holds no project-wide storage role). Found this
# gap while wiring up GitHub Actions automation — an automated `plan`
# would have failed reading this bucket's IAM policy without it, even
# though the one-off manual applies so far worked (they ran under the
# human owner's own credentials, not the deployer SA).
data "google_storage_bucket" "resumes" {
  name = var.existing_gcs_bucket_name
}

resource "google_storage_bucket_iam_member" "deployer_resume_bucket_access" {
  bucket = data.google_storage_bucket.resumes.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.deployer.email}"
}
