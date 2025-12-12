terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "automind-terraform-state"
    prefix = "simulador"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
