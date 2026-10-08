# Currently-deployed image references for production — same purpose and
# mechanism as environments/staging/image_tags.tfvars (read that file's
# header comment for why this exists at all). Starts at the bootstrap
# placeholder until the first real deploy-*-production workflow run
# updates it.

backend_image  = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/backend:6dd6b5c8191e74438db3786df9edda7ccf8e2e25"
frontend_image = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/frontend:6fd514d6138887a4861b54241c5dba132e2399d9"
