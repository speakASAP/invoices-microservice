#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NAMESPACE="${NAMESPACE:-statex-apps}"
VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
SELLER_VAULT_SECRET_PATH="${SELLER_VAULT_SECRET_PATH:-secret/prod/invoices-microservice-seller}"
SELLER_EXTERNAL_SECRET_MANIFEST="${SELLER_EXTERNAL_SECRET_MANIFEST:-${PROJECT_ROOT}/k8s/seller-external-secret.yaml}"
SELLER_EXTERNAL_SECRET_NAME="${SELLER_EXTERNAL_SECRET_NAME:-invoices-microservice-seller-secret}"
SELLER_SECRET_NAME="${SELLER_SECRET_NAME:-invoices-microservice-seller-secret}"
VERIFY_ONLY="${VERIFY_ONLY:-false}"

REQUIRED_KEYS=(
  INVOICE_SELLER_NAME
  INVOICE_SELLER_ADDRESS
)

OPTIONAL_KEYS=(
  INVOICE_SELLER_COMPANY_ID
  INVOICE_SELLER_TAX_ID
  INVOICE_SELLER_VAT_ID
  INVOICE_SELLER_EMAIL
)

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

read_vault_field() {
  local field="$1"
  export VAULT_ADDR
  vault kv get -field="$field" "$SELLER_VAULT_SECRET_PATH" 2>/dev/null || true
}

non_placeholder() {
  local value="$1"
  [ -n "$value" ] && [ "$value" != "replace-me" ] && [ "$value" != "changeme" ] && [ "$value" != "TODO" ]
}

require_command vault
require_command kubectl
export VAULT_ADDR

if ! vault kv metadata get "$SELLER_VAULT_SECRET_PATH" >/dev/null 2>&1; then
  fail "Vault path ${SELLER_VAULT_SECRET_PATH}"
fi
ok "Vault path ${SELLER_VAULT_SECRET_PATH} exists"

for key in "${REQUIRED_KEYS[@]}"; do
  value="$(read_vault_field "$key")"
  if non_placeholder "$value"; then
    ok "Vault key ${SELLER_VAULT_SECRET_PATH}.${key} is configured"
  else
    fail "Vault key ${SELLER_VAULT_SECRET_PATH}.${key} is configured"
  fi
done

company_id="$(read_vault_field INVOICE_SELLER_COMPANY_ID)"
tax_id="$(read_vault_field INVOICE_SELLER_TAX_ID)"
vat_id="$(read_vault_field INVOICE_SELLER_VAT_ID)"
if non_placeholder "$company_id" || non_placeholder "$tax_id" || non_placeholder "$vat_id"; then
  ok "seller legal tax/company identifier is configured in Vault"
else
  fail "seller legal tax/company identifier in Vault"
fi

for key in "${OPTIONAL_KEYS[@]}"; do
  value="$(read_vault_field "$key")"
  if non_placeholder "$value"; then
    ok "Vault key ${SELLER_VAULT_SECRET_PATH}.${key} is configured"
  else
    ok "Vault key ${SELLER_VAULT_SECRET_PATH}.${key} is optional or empty"
  fi
done

if [ "$VERIFY_ONLY" = "true" ]; then
  ok "seller legal Vault source passed verify-only checks"
  exit 0
fi

if [ ! -f "$SELLER_EXTERNAL_SECRET_MANIFEST" ]; then
  fail "seller ExternalSecret manifest ${SELLER_EXTERNAL_SECRET_MANIFEST}"
fi

kubectl apply -f "$SELLER_EXTERNAL_SECRET_MANIFEST"
kubectl annotate externalsecret -n "$NAMESPACE" "$SELLER_EXTERNAL_SECRET_NAME" \
  force-sync="$(date +%s)" --overwrite >/dev/null

for attempt in $(seq 1 30); do
  if kubectl get secret -n "$NAMESPACE" "$SELLER_SECRET_NAME" >/dev/null 2>&1; then
    ok "Kubernetes seller secret ${SELLER_SECRET_NAME} exists"
    break
  fi
  sleep 2
  if [ "$attempt" = "30" ]; then
    fail "Kubernetes seller secret ${SELLER_SECRET_NAME}"
  fi
done

ALLOW_CONSUMER_DISABLED=true bash "${SCRIPT_DIR}/check-final-smoke-prereqs.sh"
ok "seller legal secret is synced and pre-consumer final-smoke prerequisites pass"
