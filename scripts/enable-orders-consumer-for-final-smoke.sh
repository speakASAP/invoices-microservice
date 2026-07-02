#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NAMESPACE="${NAMESPACE:-statex-apps}"
INVOICES_CONFIGMAP="${INVOICES_CONFIGMAP:-invoices-microservice-config}"
INVOICES_DEPLOYMENT="${INVOICES_DEPLOYMENT:-invoices-microservice}"

ok() {
  printf 'OK: %s\n' "$1"
}

fail() {
  printf '[MISSING: %s]\n' "$1" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "required command ${command_name} is unavailable"
  fi
}

require_command kubectl

printf 'Checking final-smoke prerequisites before enabling Orders consumer...\n'
if ! ALLOW_CONSUMER_DISABLED=true bash "${SCRIPT_DIR}/check-final-smoke-prereqs.sh"; then
  fail "all final-smoke prerequisites except ORDERS_EVENTS_CONSUMER_ENABLED=true must pass before enabling consumer"
fi

current_value="$(kubectl get configmap -n "$NAMESPACE" "$INVOICES_CONFIGMAP" -o jsonpath='{.data.ORDERS_EVENTS_CONSUMER_ENABLED}' 2>/dev/null || true)"
if [ "$current_value" = "true" ]; then
  ok "ORDERS_EVENTS_CONSUMER_ENABLED is already true"
else
  printf 'Enabling ORDERS_EVENTS_CONSUMER_ENABLED=true on ConfigMap %s/%s...\n' "$NAMESPACE" "$INVOICES_CONFIGMAP"
  kubectl patch configmap -n "$NAMESPACE" "$INVOICES_CONFIGMAP" \
    --type merge \
    -p '{"data":{"ORDERS_EVENTS_CONSUMER_ENABLED":"true"}}'
fi

printf 'Restarting deployment %s/%s so the consumer switch is picked up...\n' "$NAMESPACE" "$INVOICES_DEPLOYMENT"
kubectl rollout restart "deployment/${INVOICES_DEPLOYMENT}" -n "$NAMESPACE"
kubectl rollout status "deployment/${INVOICES_DEPLOYMENT}" -n "$NAMESPACE" --timeout=180s

printf 'Verifying strict final-smoke prerequisites after consumer enablement...\n'
bash "${SCRIPT_DIR}/check-final-smoke-prereqs.sh"
ok "ORDERS_EVENTS_CONSUMER_ENABLED=true is active and final-smoke prerequisites pass"
