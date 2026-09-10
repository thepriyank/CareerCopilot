# Currently-deployed image references for staging. Tracked in git
# (deliberately NOT *.auto.tfvars — see root .gitignore's comment on why
# that pattern is ignored) and passed explicitly via `-var-file` by every
# workflow/command that plans or applies this environment.
#
# Why this file exists at all: backend_image/frontend_image's declared
# defaults (variables.tf) are the bootstrap placeholder image, used only to
# get the very first `apply` off the ground before any real image existed
# (see README.md Step 3). Without this file, an infra-only apply (e.g. a
# Terraform module change with no app-code change) would silently pass no
# -var for these and Cloud Run would revert to that placeholder, undoing
# the real deployment. deploy-backend.yml / deploy-frontend.yml update the
# relevant line here and commit it back after every successful image push
# — see .github/workflows/ for exactly how.
#
# Keep this in sync with reality — infra/terraform/INFRASTRUCTURE.md's
# "Deploy history" is the narrative; this file is the machine-read value.

backend_image  = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/backend:f8eeba5f34e08fa0e0a1253178f8fe8cb47bbd4e"
frontend_image = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/frontend:f8eeba5f34e08fa0e0a1253178f8fe8cb47bbd4e"
