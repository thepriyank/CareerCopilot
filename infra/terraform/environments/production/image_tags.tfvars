# Currently-deployed image references for production — same purpose and
# mechanism as environments/staging/image_tags.tfvars (read that file's
# header comment for why this exists at all). Starts at the bootstrap
# placeholder until the first real deploy-*-production workflow run
# updates it.

backend_image  = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/backend:e0f7959ff54c4d8d50b8405f8ac27697e585b772"
frontend_image = "asia-southeast1-docker.pkg.dev/jobmagnet-6a1ab/jobmagnate/frontend:e0f7959ff54c4d8d50b8405f8ac27697e585b772"
