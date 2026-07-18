# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6/7 (Phase C) for the design.
# scripts/deploy.sh is still the live, authoritative deploy path.

SERVICE_NAME="invoices-microservice"
PORT="3204"

IMAGES=(
  "invoices-microservice|.||"
)

DEPLOYMENTS=(
  "invoices-microservice|app|invoices-microservice"
)

# MANIFESTS left at the runner default (configmap, external-secret, deployment,
# service, ingress) — matches the real script's manifest set exactly (applied
# there via one multi -f invocation instead of a loop; same net effect).
