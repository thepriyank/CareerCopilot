terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Same state bucket as staging, distinct prefix — see bootstrap/.
  backend "gcs" {
    bucket = "jobmagnet-6a1ab-tfstate"
    prefix = "env/production"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
