# Currently-deployed image references for production — same purpose and
# mechanism as environments/staging/image_tags.tfvars (read that file's
# header comment for why this exists at all). Starts at the bootstrap
# placeholder until the first real deploy-*-production workflow run
# updates it.

backend_image  = "us-docker.pkg.dev/cloudrun/container/hello"
frontend_image = "us-docker.pkg.dev/cloudrun/container/hello"
