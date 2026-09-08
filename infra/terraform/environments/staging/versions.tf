terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Bucket name is hardcoded (Terraform backend blocks can't reference
  # variables) — must match bootstrap's state_bucket_name output/default
  # exactly. Distinct `prefix` per environment keeps staging/production
  # state from ever colliding in the same bucket.
  backend "gcs" {
    bucket = "jobmagnet-6a1ab-tfstate"
    prefix = "env/staging"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
