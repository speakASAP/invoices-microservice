#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_NAME="invoices-microservice"
NAMESPACE="statex-apps"
REGISTRY="localhost:5000"
HEALTH_PORT="${HEALTH_PORT:-3204}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
# Tag describes the WORKING TREE that is actually built, not just git HEAD:
# a tag derived from HEAD alone repeats itself when files changed without a
# commit, which makes `kubectl set image` a no-op and silently keeps the old
# image running.
compute_default_tag() {
  local head dirty root
  root="${PROJECT_ROOT:-$(pwd)}"
  head="$(git -C "$root" rev-parse --short HEAD 2>/dev/null || true)"
  if [ -z "$head" ]; then
    echo "build-$(date -u +%Y%m%d%H%M%S)"
    return
  fi
  dirty="$(git -C "$root" status --porcelain 2>/dev/null || true)"
  if [ -n "$dirty" ]; then
    echo "${head}-wt$(date -u +%Y%m%d%H%M%S)"
  else
    echo "$head"
  fi
}

IMAGE_TAG="${1:-$(compute_default_tag)}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
IMAGE_LATEST="${REGISTRY}/${SERVICE_NAME}:latest"

cd "$PROJECT_ROOT"
npm run build
npm test
npm run verify:contracts
npm run verify:runtime-readiness
npm run verify:runtime-prereqs

docker build -t "$IMAGE" -t "$IMAGE_LATEST" "$PROJECT_ROOT"
docker push "$IMAGE"
docker push "$IMAGE_LATEST"

kubectl apply -f k8s/configmap.yaml -f k8s/external-secret.yaml -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/ingress.yaml
kubectl set image "deployment/${SERVICE_NAME}" app="$IMAGE" -n "$NAMESPACE"
kubectl rollout status "deployment/${SERVICE_NAME}" -n "$NAMESPACE" --timeout=180s

POD="$(kubectl get pod -n "$NAMESPACE" -l "app=${SERVICE_NAME}" -o jsonpath='{.items[0].metadata.name}')"
kubectl exec -n "$NAMESPACE" "$POD" -- node -e "fetch('http://127.0.0.1:${HEALTH_PORT}${HEALTH_PATH}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
echo "Deployed ${IMAGE}"
