# Production environment variables (non-sensitive)
# Sensitive variables are provided via GitHub Secrets in CI/CD

project_id = "automind-480922"
region     = "us-central1"

# Cloud Run
service_name  = "car-financing-simulator"
cpu           = 1
memory        = "1Gi"
max_instances = 10
min_instances = 0
