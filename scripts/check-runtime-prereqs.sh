#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-statex-apps}"
VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_SECRET_PATH="${VAULT_SECRET_PATH:-secret/prod/invoices-microservice}"
DB_NAME="${DB_NAME:-invoices}"
POSTGRES_MATCH="${POSTGRES_MATCH:-db-server-postgres}"

REQUIRED_VAULT_KEYS=(
  DB_PASSWORD
  INVOICES_INTERNAL_SERVICE_TOKEN
  ORDERS_SERVICE_TOKEN
  PAYMENTS_API_KEY
  NOTIFICATIONS_SERVICE_TOKEN
  INVOICE_SELLER_NAME
  INVOICE_SELLER_ADDRESS
  INVOICE_SELLER_COMPANY_ID
  INVOICE_SELLER_TAX_ID
  INVOICE_SELLER_VAT_ID
  INVOICE_SELLER_EMAIL
)

REQUIRED_DEPLOYMENTS=(
  orders-microservice
  payments-microservice
  notifications-microservice
  logging-microservice
)

REQUIRED_STATEFULSETS=(
  rabbitmq
)

missing=0

ok() {
  printf 'OK: %s\n' "$1"
}

missing() {
  printf '[MISSING: %s]\n' "$1"
  missing=1
}

unknown() {
  printf '[UNKNOWN: %s]\n' "$1"
  missing=1
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    unknown "required command ${command_name} is unavailable"
    return 1
  fi
  ok "command ${command_name} is available"
}

check_vault_secret() {
  if ! require_command vault; then
    return
  fi

  export VAULT_ADDR

  if ! vault kv metadata get "$VAULT_SECRET_PATH" >/dev/null 2>&1; then
    missing "Vault path ${VAULT_SECRET_PATH}"
    return
  fi

  ok "Vault path ${VAULT_SECRET_PATH} exists"

  local key
  for key in "${REQUIRED_VAULT_KEYS[@]}"; do
    if vault kv get -field="$key" "$VAULT_SECRET_PATH" >/dev/null 2>&1; then
      ok "Vault key ${VAULT_SECRET_PATH}.${key} exists"
    else
      missing "Vault key ${VAULT_SECRET_PATH}.${key}"
    fi
  done
}

check_database() {
  if ! require_command kubectl; then
    return
  fi

  local postgres_pod
  postgres_pod="$(
    kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null \
      | awk -v pod_pattern="$POSTGRES_MATCH" '$1 ~ pod_pattern && $3 == "Running" { print $1; exit }'
  )"

  if [ -z "$postgres_pod" ]; then
    missing "running Postgres pod matching ${POSTGRES_MATCH} in namespace ${NAMESPACE}"
    return
  fi

  ok "running Postgres pod ${postgres_pod}"

  if kubectl exec -n "$NAMESPACE" "$postgres_pod" -- \
    env CHECK_DB_NAME="$DB_NAME" sh -lc \
      'psql -U "$POSTGRES_USER" -d "${POSTGRES_DB:-postgres}" -tAc "select datname from pg_database" | grep -Fx "$CHECK_DB_NAME" >/dev/null' \
      >/dev/null 2>&1; then
    ok "database ${DB_NAME} exists"
  else
    missing "database ${DB_NAME}"
  fi
}

check_deployment_ready() {
  local name="$1"
  local desired
  local ready

  desired="$(kubectl get deployment -n "$NAMESPACE" "$name" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"
  if [ -z "$desired" ]; then
    missing "deployment ${name} exists in namespace ${NAMESPACE}"
    return
  fi

  ready="$(kubectl get deployment -n "$NAMESPACE" "$name" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  ready="${ready:-0}"

  if [ "$ready" -ge "$desired" ]; then
    ok "deployment ${name} ready ${ready}/${desired}"
  else
    missing "deployment ${name} ready ${ready}/${desired}"
  fi
}

check_statefulset_ready() {
  local name="$1"
  local desired
  local ready

  desired="$(kubectl get statefulset -n "$NAMESPACE" "$name" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"
  if [ -z "$desired" ]; then
    missing "statefulset ${name} exists in namespace ${NAMESPACE}"
    return
  fi

  ready="$(kubectl get statefulset -n "$NAMESPACE" "$name" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  ready="${ready:-0}"

  if [ "$ready" -ge "$desired" ]; then
    ok "statefulset ${name} ready ${ready}/${desired}"
  else
    missing "statefulset ${name} ready ${ready}/${desired}"
  fi
}

check_workloads() {
  if ! require_command kubectl; then
    return
  fi

  local name
  for name in "${REQUIRED_DEPLOYMENTS[@]}"; do
    check_deployment_ready "$name"
  done

  for name in "${REQUIRED_STATEFULSETS[@]}"; do
    check_statefulset_ready "$name"
  done
}

check_vault_secret
check_database
check_workloads

if [ "$missing" -ne 0 ]; then
  printf 'Runtime prerequisites check failed\n'
  exit 1
fi

printf 'Runtime prerequisites check passed\n'
