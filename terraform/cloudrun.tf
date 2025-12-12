# Cloud Run service
resource "google_cloud_run_service" "simulator" {
  name     = var.service_name
  location = var.region

  template {
    spec {
      containers {
        image = var.docker_image

        resources {
          limits = {
            cpu    = "${var.cpu}"
            memory = var.memory
          }
        }

        env {
          name  = "C6AUTO_CPF"
          value = var.c6auto_cpf
        }

        env {
          name  = "C6AUTO_SENHA"
          value = var.c6auto_senha
        }

        env {
          name  = "SERVICE_BASIC_AUTH"
          value = var.service_basic_auth
        }

        env {
          name  = "BACKEND_BASIC_AUTH"
          value = var.backend_basic_auth
        }

        env {
          name  = "BACKEND_URL"
          value = var.backend_url
        }

        env {
          name  = "HEADLESS"
          value = "true"
        }
      }

      container_concurrency = 1
      timeout_seconds       = 3600  # 60 minutes (max)
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "${var.max_instances}"
        "autoscaling.knative.dev/minScale" = "${var.min_instances}"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# IAM: Allow unauthenticated access (or restrict to specific service accounts)
resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_service.simulator.name
  location = google_cloud_run_service.simulator.location
  role     = "roles/run.invoker"
  member   = "allUsers"  # Change to specific service account if needed
}
