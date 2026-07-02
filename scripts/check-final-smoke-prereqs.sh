#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NAMESPACE="${NAMESPACE:-statex-apps}"
VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
INVOICES_VAULT_SECRET_PATH="${INVOICES_VAULT_SECRET_PATH:-secret/prod/invoices-microservice}"
PAYMENTS_VAULT_SECRET_PATH="${PAYMENTS_VAULT_SECRET_PATH:-secret/prod/payments-microservice}"
POSTGRES_MATCH="${POSTGRES_MATCH:-db-server-postgres}"
NOTIFICATIONS_DB_NAME="${NOTIFICATIONS_DB_NAME:-notifications}"
NOTIFICATIONS_REPO="${NOTIFICATIONS_REPO:-/home/ssf/Documents/Github/notifications-microservice}"
INVOICES_DEPLOYMENT="${INVOICES_DEPLOYMENT:-invoices-microservice}"
INVOICES_CONFIGMAP="${INVOICES_CONFIGMAP:-invoices-microservice-config}"
SELLER_SECRET_NAME="${SELLER_SECRET_NAME:-invoices-microservice-seller-secret}"
NOTIFICATIONS_SECRET_NAME="${NOTIFICATIONS_SECRET_NAME:-notifications-microservice-secret}"
NOTIFICATIONS_CHANNEL_KEY="${INVOICES_NOTIFICATION_CHANNEL_KEY:-invoices.documents}"
NOTIFICATIONS_SERVICE_NAME="${NOTIFICATIONS_SERVICE_NAME:-invoices-microservice}"
NOTIFICATIONS_PURPOSE="${NOTIFICATIONS_PURPOSE:-transactional}"
REQUIRED_PAYMENTS_SCOPE="${REQUIRED_PAYMENTS_SCOPE:-payments:read}"
ALLOW_CONSUMER_DISABLED="${ALLOW_CONSUMER_DISABLED:-false}"

missing=0

ok() {
  printf 'OK: %s\n' "$1"
}

missing_item() {
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

read_vault_field() {
  local path="$1"
  local field="$2"
  export VAULT_ADDR
  vault kv get -field="$field" "$path" 2>/dev/null || true
}

read_secret_key() {
  local secret_name="$1"
  local key="$2"
  kubectl get secret -n "$NAMESPACE" "$secret_name" -o "jsonpath={.data.${key}}" 2>/dev/null | base64 -d 2>/dev/null || true
}

csv_has_exact_value() {
  local csv="$1"
  local needle="$2"
  local entry
  IFS=',' read -r -a entries <<< "$csv"
  for entry in "${entries[@]}"; do
    entry="$(printf '%s' "$entry" | xargs)"
    if [ "$entry" = "$needle" ]; then
      return 0
    fi
  done
  return 1
}

scope_map_has_scope() {
  local raw="$1"
  local key="$2"
  local required_scope="$3"
  local entry
  IFS=',' read -r -a entries <<< "$raw"
  for entry in "${entries[@]}"; do
    entry="$(printf '%s' "$entry" | xargs)"
    [ -n "$entry" ] || continue
    local map_key="${entry%%=*}"
    local scopes="${entry#*=}"
    map_key="$(printf '%s' "$map_key" | xargs)"
    if [ "$map_key" != "$key" ] || [ "$scopes" = "$entry" ]; then
      continue
    fi
    local scope
    IFS='|' read -r -a scope_entries <<< "$scopes"
    for scope in "${scope_entries[@]}"; do
      scope="$(printf '%s' "$scope" | xargs)"
      if [ "$scope" = "$required_scope" ]; then
        return 0
      fi
    done
  done
  return 1
}

non_placeholder() {
  local value="$1"
  [ -n "$value" ] && [ "$value" != "replace-me" ] && [ "$value" != "changeme" ] && [ "$value" != "TODO" ]
}

find_postgres_pod() {
  kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null     | awk -v pod_pattern="$POSTGRES_MATCH" '$1 ~ pod_pattern && $3 == "Running" { print $1; exit }'
}

check_core_runtime_prereqs() {
  printf 'Checking core runtime prerequisites through verify:runtime-prereqs...\n'
  if bash "${SCRIPT_DIR}/check-runtime-prereqs.sh"; then
    ok "core runtime prerequisites pass"
  else
    missing_item "core runtime prerequisites pass before final smoke"
  fi
}

check_invoices_deployment_ready() {
  if ! require_command kubectl; then
    return
  fi

  local desired ready
  desired="$(kubectl get deployment -n "$NAMESPACE" "$INVOICES_DEPLOYMENT" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"
  if [ -z "$desired" ]; then
    missing_item "deployment ${INVOICES_DEPLOYMENT} exists in namespace ${NAMESPACE}"
    return
  fi
  ready="$(kubectl get deployment -n "$NAMESPACE" "$INVOICES_DEPLOYMENT" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  ready="${ready:-0}"
  if [ "$ready" -ge "${desired:-1}" ] && [ "${desired:-0}" -gt 0 ]; then
    ok "deployment ${INVOICES_DEPLOYMENT} ready ${ready}/${desired}"
  else
    missing_item "deployment ${INVOICES_DEPLOYMENT} ready ${ready}/${desired:-0}"
  fi
}

check_invoices_config_for_final_smoke() {
  if ! require_command kubectl; then
    return
  fi

  local base_url consumer_enabled
  base_url="$(kubectl get configmap -n "$NAMESPACE" "$INVOICES_CONFIGMAP" -o jsonpath='{.data.INVOICES_PUBLIC_BASE_URL}' 2>/dev/null || true)"
  consumer_enabled="$(kubectl get configmap -n "$NAMESPACE" "$INVOICES_CONFIGMAP" -o jsonpath='{.data.ORDERS_EVENTS_CONSUMER_ENABLED}' 2>/dev/null || true)"

  if [[ "$base_url" == https://* ]]; then
    ok "INVOICES_PUBLIC_BASE_URL is configured with https"
  else
    missing_item "INVOICES_PUBLIC_BASE_URL configured with https"
  fi

  if [ "$consumer_enabled" = "true" ]; then
    ok "ORDERS_EVENTS_CONSUMER_ENABLED=true for RabbitMQ final smoke"
  elif [ "$ALLOW_CONSUMER_DISABLED" = "true" ]; then
    ok "ORDERS_EVENTS_CONSUMER_ENABLED is currently disabled and allowed for pre-enable checks"
  else
    missing_item "ORDERS_EVENTS_CONSUMER_ENABLED=true for RabbitMQ final smoke"
  fi
}

check_seller_legal_secret() {
  if ! require_command kubectl; then
    return
  fi

  if ! kubectl get secret -n "$NAMESPACE" "$SELLER_SECRET_NAME" >/dev/null 2>&1; then
    missing_item "seller legal secret ${SELLER_SECRET_NAME}"
    return
  fi

  ok "seller legal secret ${SELLER_SECRET_NAME} exists"

  local name address company_id tax_id vat_id
  name="$(read_secret_key "$SELLER_SECRET_NAME" INVOICE_SELLER_NAME)"
  address="$(read_secret_key "$SELLER_SECRET_NAME" INVOICE_SELLER_ADDRESS)"
  company_id="$(read_secret_key "$SELLER_SECRET_NAME" INVOICE_SELLER_COMPANY_ID)"
  tax_id="$(read_secret_key "$SELLER_SECRET_NAME" INVOICE_SELLER_TAX_ID)"
  vat_id="$(read_secret_key "$SELLER_SECRET_NAME" INVOICE_SELLER_VAT_ID)"

  if non_placeholder "$name"; then ok "seller legal name is configured"; else missing_item "seller legal name"; fi
  if non_placeholder "$address"; then ok "seller legal address is configured"; else missing_item "seller legal address"; fi
  if non_placeholder "$company_id" || non_placeholder "$tax_id" || non_placeholder "$vat_id"; then
    ok "seller legal tax/company identifier is configured"
  else
    missing_item "seller legal tax/company identifier"
  fi
}

check_payments_key_scope() {
  if ! require_command vault; then
    return
  fi

  local invoices_key payments_keys payment_scopes
  invoices_key="$(read_vault_field "$INVOICES_VAULT_SECRET_PATH" PAYMENTS_API_KEY)"
  payments_keys="$(read_vault_field "$PAYMENTS_VAULT_SECRET_PATH" API_KEYS)"
  payment_scopes="$(read_vault_field "$PAYMENTS_VAULT_SECRET_PATH" PAYMENT_API_KEY_SCOPES)"

  if [ -z "$invoices_key" ]; then
    missing_item "Vault key ${INVOICES_VAULT_SECRET_PATH}.PAYMENTS_API_KEY"
    return
  fi
  ok "invoices PAYMENTS_API_KEY exists in Vault"

  if [ -z "$payments_keys" ]; then
    missing_item "Vault key ${PAYMENTS_VAULT_SECRET_PATH}.API_KEYS"
    return
  fi
  if [ -z "$payment_scopes" ]; then
    missing_item "Vault key ${PAYMENTS_VAULT_SECRET_PATH}.PAYMENT_API_KEY_SCOPES"
    return
  fi

  if csv_has_exact_value "$payments_keys" "$invoices_key"; then
    ok "Payments API_KEYS includes the invoices key"
  else
    missing_item "Payments API_KEYS includes the invoices key"
  fi

  if scope_map_has_scope "$payment_scopes" "$invoices_key" "$REQUIRED_PAYMENTS_SCOPE"; then
    ok "Payments API key has ${REQUIRED_PAYMENTS_SCOPE} scope"
  else
    missing_item "Payments API key has ${REQUIRED_PAYMENTS_SCOPE} scope"
  fi
}

check_notifications_token_projection() {
  if ! require_command vault || ! require_command kubectl; then
    return
  fi

  local vault_token projected_token
  vault_token="$(read_vault_field "$INVOICES_VAULT_SECRET_PATH" NOTIFICATIONS_SERVICE_TOKEN)"
  projected_token="$(read_secret_key "$NOTIFICATIONS_SECRET_NAME" INVOICES_NOTIFICATIONS_SERVICE_TOKEN)"

  if [ -z "$vault_token" ]; then
    missing_item "Vault key ${INVOICES_VAULT_SECRET_PATH}.NOTIFICATIONS_SERVICE_TOKEN"
    return
  fi
  ok "invoices NOTIFICATIONS_SERVICE_TOKEN exists in Vault"

  if [ -z "$projected_token" ]; then
    missing_item "Kubernetes secret ${NOTIFICATIONS_SECRET_NAME}.INVOICES_NOTIFICATIONS_SERVICE_TOKEN"
    return
  fi

  if [ "$projected_token" = "$vault_token" ]; then
    ok "Notifications projected invoices token matches Vault"
  else
    missing_item "Notifications projected invoices token matches Vault"
  fi
}

check_notifications_channel_policy() {
  if ! require_command kubectl; then
    return
  fi

  local postgres_pod result sql
  postgres_pod="$(find_postgres_pod)"
  if [ -z "$postgres_pod" ]; then
    missing_item "running Postgres pod matching ${POSTGRES_MATCH} in namespace ${NAMESPACE}"
    return
  fi

  sql="$(cat <<'SQL'
select case when exists (
  select 1
  from channel_registry
  where "channelKey" = :'channel'
    and "isActive" = true
    and (
      coalesce(cardinality("applicationsAllowed"), 0) = 0
      or :'service' = any("applicationsAllowed")
    )
    and (
      coalesce(cardinality("purposesAllowed"), 0) = 0
      or :'purpose' = any("purposesAllowed")
    )
) then 'ok' else 'missing' end;
SQL
)"

  result="$(printf '%s\n' "$sql" | kubectl exec -i -n "$NAMESPACE" "$postgres_pod" -- env \
    CHECK_DB_NAME="$NOTIFICATIONS_DB_NAME" \
    CHECK_CHANNEL_KEY="$NOTIFICATIONS_CHANNEL_KEY" \
    CHECK_SERVICE="$NOTIFICATIONS_SERVICE_NAME" \
    CHECK_PURPOSE="$NOTIFICATIONS_PURPOSE" \
    sh -lc 'psql -U "$POSTGRES_USER" -d "$CHECK_DB_NAME" -v channel="$CHECK_CHANNEL_KEY" -v service="$CHECK_SERVICE" -v purpose="$CHECK_PURPOSE" -tA' 2>/dev/null || true)"

  if [ "$(printf '%s' "$result" | tr -d '[:space:]')" = "ok" ]; then
    ok "Notifications ${NOTIFICATIONS_CHANNEL_KEY} channel policy allows ${NOTIFICATIONS_SERVICE_NAME}/${NOTIFICATIONS_PURPOSE}"
  else
    missing_item "Notifications channel_registry policy for ${NOTIFICATIONS_CHANNEL_KEY} allows ${NOTIFICATIONS_SERVICE_NAME}/${NOTIFICATIONS_PURPOSE}"
  fi
}

check_notifications_no_send_validate() {
  if [ ! -x "${NOTIFICATIONS_REPO}/scripts/check-invoices-documents-readiness.sh" ]; then
    unknown "Notifications no-send readiness script is unavailable or not executable"
    return
  fi

  if bash "${NOTIFICATIONS_REPO}/scripts/check-invoices-documents-readiness.sh"; then
    ok "Notifications no-send invoices.documents validation passes"
  else
    missing_item "Notifications no-send invoices.documents validation passes"
  fi
}

printf 'Invoices final smoke prerequisites check\n'
printf 'Namespace: %s | Invoices Vault: %s | Payments Vault: %s | Channel: %s\n'   "$NAMESPACE" "$INVOICES_VAULT_SECRET_PATH" "$PAYMENTS_VAULT_SECRET_PATH" "$NOTIFICATIONS_CHANNEL_KEY"

check_core_runtime_prereqs
check_invoices_deployment_ready
check_invoices_config_for_final_smoke
check_seller_legal_secret
check_payments_key_scope
check_notifications_token_projection
check_notifications_channel_policy
check_notifications_no_send_validate

if [ "$missing" -ne 0 ]; then
  printf 'Final smoke prerequisites check failed\n'
  exit 1
fi

printf 'Final smoke prerequisites check passed\n'
