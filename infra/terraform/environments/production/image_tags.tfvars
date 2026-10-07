# Currently-deployed image references for production — same purpose and
# mechanism as environments/staging/image_tags.tfvars (read that file's
# header comment for why this exists at all). Starts at the bootstrap
# placeholder until the first real deploy-*-production workflow run
# updates it.

backend_image  = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/backend:3355b4bbdf110d06e6b72eb37065f02f17c1f393"
frontend_image = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/frontend:6fd514d6138887a4861b54241c5dba132e2399d9"
