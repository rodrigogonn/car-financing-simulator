# Artifact Registry repository for Docker images
resource "google_artifact_registry_repository" "simulador" {
  location      = var.region
  repository_id = "simulador"
  description   = "Docker repository for simulador"
  format        = "DOCKER"
}

output "artifact_registry_url" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.simulador.repository_id}"
}
