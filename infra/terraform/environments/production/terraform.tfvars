# Real, reviewed, non-secret config for production. No secret VALUES
# belong in this file — see modules/secret-manager-secret's runbook note
# and README.md.

project_id  = "jobmagnet-6a1ab"
region      = "asia-southeast1"
environment = "production"

existing_gcs_bucket_name = "jobmagnet-user-data"
firebase_project_id      = "jobmagnet-6a1ab"

# backend_image / frontend_image intentionally left at their placeholder
# defaults — see README.md's bootstrap order (same as staging's first
# apply had to work through).
