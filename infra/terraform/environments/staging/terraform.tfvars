# Real, reviewed, non-secret config for staging. No secret VALUES belong in
# this file — see modules/secret-manager-secret's runbook note and
# README.md.

project_id  = "jobmagnet-6a1ab"
region      = "asia-southeast1"
environment = "staging"

existing_gcs_bucket_name = "jobmagnet-user-data"
firebase_project_id      = "jobmagnet-6a1ab"

# backend_image / frontend_image intentionally left at their placeholder
# defaults here — override with -var on the CLI (or a *.auto.tfvars,
# gitignored) once a real image has been pushed to Artifact Registry. See
# README.md's bootstrap order.
