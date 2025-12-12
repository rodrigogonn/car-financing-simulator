variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "c6auto_cpf" {
  description = "C6 Auto CPF"
  type        = string
  sensitive   = true
}

variable "c6auto_senha" {
  description = "C6 Auto senha"
  type        = string
  sensitive   = true
}

variable "service_basic_auth" {
  description = "Basic auth for simulator service (format: user:pass)"
  type        = string
  sensitive   = true
}

variable "backend_basic_auth" {
  description = "Basic auth for backend (format: user:pass)"
  type        = string
  sensitive   = true
}

variable "backend_url" {
  description = "Backend URL for callbacks"
  type        = string
}

variable "docker_image" {
  description = "Docker image URL (e.g., gcr.io/PROJECT_ID/simulador:latest)"
  type        = string
  default     = ""
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "car-financing-simulator"
}

variable "cpu" {
  description = "CPU allocation (1 = 1 vCPU)"
  type        = number
  default     = 1
}

variable "memory" {
  description = "Memory allocation in GB"
  type        = string
  default     = "1Gi"
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "min_instances" {
  description = "Minimum number of instances (0 = scale to zero)"
  type        = number
  default     = 0
}
