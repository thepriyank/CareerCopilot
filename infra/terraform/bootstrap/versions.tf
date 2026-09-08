terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # No backend block here on purpose: this config CREATES the GCS bucket
  # that every other environment's state lives in, so it can't depend on
  # that bucket existing yet. Its own state stays local (terraform.tfstate
  # next to these files, gitignored) — this is a one-time, rarely-touched
  # config; see README.md for why that's an acceptable trade-off here.
}

provider "google" {
  project = var.project_id
  region  = var.region
}
