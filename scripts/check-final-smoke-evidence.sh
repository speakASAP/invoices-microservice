#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NAMESPACE="${NAMESPACE:-statex-apps}"
POSTGRES_MATCH="${POSTGRES_MATCH:-db-server-postgres}"
INVOICES_DB_NAME="${INVOICES_DB_NAME:-invoices}"
INVOICES_SECRET_NAME="${INVOICES_SECRET_NAME:-invoices-microservice-secret}"
INVOICES_BASE_URL="${INVOICES_BASE_URL:-https://invoices.alfares.cz}"
PAYMENTS_BASE_URL="${PAYMENTS_BASE_URL:-https://payments.alfares.cz}"
LOGGING_BASE_URL="${LOGGING_BASE_URL:-https://logging.alfares.cz}"
SKIP_FINAL_SMOKE_PREREQS="${SKIP_FINAL_SMOKE_PREREQS:-false}"
REQUIRE_CUSTOMER_ACCOUNT="${REQUIRE_CUSTOMER_ACCOUNT:-false}"
REQUIRE_LOGGING_EVIDENCE="${REQUIRE_LOGGING_EVIDENCE:-false}"
VERIFY_DOWNLOAD_LINK_ROTATION="${VERIFY_DOWNLOAD_LINK_ROTATION:-false}"
VERIFY_PUBLIC_LINKS="${VERIFY_PUBLIC_LINKS:-false}"
FINAL_SMOKE_APPROVED="${FINAL_SMOKE_APPROVED:-false}"
PAYMENT_APPLICATION_ID="${PAYMENT_APPLICATION_ID:-}"
ORDER_ID="${ORDER_ID:-}"

missing=0
TMP_FILES=()

cleanup() {
  local path
  for path in "${TMP_FILES[@]}"; do
    [ -n "$path" ] && rm -f "$path" 2>/dev/null || true
  done
}
trap cleanup EXIT

ok() {
  printf 'OK: %s\n' "$1"
}

info() {
  printf 'INFO: %s\n' "$1"
}

missing_item() {
  printf '[MISSING: %s]\n' "$1"
  missing=1
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing_item "required command ${command_name} is unavailable"
    return 1
  fi
  ok "command ${command_name} is available"
}

require_non_empty() {
  local value="$1"
  local label="$2"
  if [ -n "$value" ]; then
    ok "$label"
  else
    missing_item "$label"
  fi
}

require_equal() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [ "$actual" = "$expected" ]; then
    ok "$label"
  else
    missing_item "$label (expected ${expected}, got ${actual:-empty})"
  fi
}

require_at_least() {
  local actual="$1"
  local minimum="$2"
  local label="$3"
  if [ "${actual:-0}" -ge "$minimum" ] 2>/dev/null; then
    ok "$label"
  else
    missing_item "$label (expected >= ${minimum}, got ${actual:-empty})"
  fi
}

require_true() {
  local actual="$1"
  local label="$2"
  if [ "$actual" = "t" ] || [ "$actual" = "true" ]; then
    ok "$label"
  else
    missing_item "$label"
  fi
}

require_false_text() {
  local actual="$1"
  local label="$2"
  if [ "$actual" = "false" ] || [ "$actual" = "f" ]; then
    ok "$label"
  else
    missing_item "$label"
  fi
}

require_status_allowed() {
  local actual="$1"
  local label="$2"
  case "$actual" in
    delivery_pending|sent|issued)
      ok "$label"
      ;;
    *)
      missing_item "$label (got ${actual:-empty})"
      ;;
  esac
}

read_secret_key() {
  local secret_name="$1"
  local key="$2"
  kubectl get secret -n "$NAMESPACE" "$secret_name" -o "jsonpath={.data.${key}}" 2>/dev/null | base64 -d 2>/dev/null || true
}

find_postgres_pod() {
  kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null \
    | awk -v pod_pattern="$POSTGRES_MATCH" '$1 ~ pod_pattern && $3 == "Running" { print $1; exit }'
}

psql_invoices() {
  local postgres_pod="$1"
  local sql="$2"
  printf '%s\n' "$sql" | kubectl exec -i -n "$NAMESPACE" "$postgres_pod" -- env \
    CHECK_DB_NAME="$INVOICES_DB_NAME" \
    CHECK_ORDER_ID="$ORDER_ID" \
    sh -lc 'psql -U "$POSTGRES_USER" -d "$CHECK_DB_NAME" -v order_id="$CHECK_ORDER_ID" -F "|" -tA' 2>/dev/null || true
}

new_tmp_file() {
  local path
  path="$(mktemp "/tmp/invoices-final-smoke.XXXXXX")"
  TMP_FILES+=("$path")
  printf '%s' "$path"
}

curl_internal_json() {
  local url="$1"
  local output="$2"
  curl -fsS \
    -H "x-internal-service-token: ${INVOICES_INTERNAL_SERVICE_TOKEN}" \
    "$url" \
    -o "$output"
}

check_invoice_rows() {
  local postgres_pod="$1"
  local invoice_sql invoice_result
  invoice_sql="$(cat <<'SQL'
select
  count(*) filter (where type = 'proforma'),
  count(*) filter (where type = 'final'),
  coalesce(max(id::text) filter (where type = 'proforma'), ''),
  coalesce(max(id::text) filter (where type = 'final'), ''),
  coalesce(max(status::text) filter (where type = 'proforma'), ''),
  coalesce(max(status::text) filter (where type = 'final'), ''),
  coalesce(bool_or(type = 'proforma' and "invoiceNumber" is not null and "invoiceNumber" <> ''), false),
  coalesce(bool_or(type = 'final' and "invoiceNumber" is not null and "invoiceNumber" <> ''), false),
  coalesce(bool_or(type = 'proforma' and currency is not null and currency <> ''), false),
  coalesce(bool_or(type = 'final' and currency is not null and currency <> ''), false),
  coalesce(bool_or(type = 'proforma' and "totalAmount" is not null), false),
  coalesce(bool_or(type = 'final' and "totalAmount" is not null), false),
  coalesce(bool_or(type = 'proforma' and "taxAmount" is not null), false),
  coalesce(bool_or(type = 'final' and "taxAmount" is not null), false),
  coalesce(bool_or(type = 'proforma' and "documentHtml" is not null), false),
  coalesce(bool_or(type = 'final' and "documentHtml" is not null), false),
  coalesce(bool_or(type = 'proforma' and "documentPdf" is not null), false),
  coalesce(bool_or(type = 'final' and "documentPdf" is not null), false),
  coalesce(bool_or(type = 'proforma' and "documentPdfSha256" is not null and "documentPdfSha256" <> ''), false),
  coalesce(bool_or(type = 'final' and "documentPdfSha256" is not null and "documentPdfSha256" <> ''), false),
  coalesce(bool_or(type = 'proforma' and "downloadTokenHash" is not null and "downloadTokenHash" <> ''), false),
  coalesce(bool_or(type = 'final' and "downloadTokenHash" is not null and "downloadTokenHash" <> ''), false),
  coalesce(bool_or(type = 'proforma' and "blockedReason" is null), false),
  coalesce(bool_or(type = 'final' and "blockedReason" is null), false),
  coalesce(bool_or(type = 'proforma' and "issuedAt" is not null), false),
  coalesce(bool_or(type = 'final' and "issuedAt" is not null), false),
  coalesce(bool_or(type = 'final' and "paymentReferenceId" is not null and "paymentReferenceId" <> ''), false),
  coalesce(bool_or(type = 'final' and "paymentSnapshot" is not null), false),
  coalesce(max("paymentSnapshot"->>'providerCall') filter (where type = 'final'), ''),
  coalesce(max("paymentSnapshot"->>'mutation') filter (where type = 'final'), ''),
  coalesce(max("paymentSnapshot"->>'persistence') filter (where type = 'final'), ''),
  coalesce(max("orderSnapshot"->>'paymentApplicationId') filter (where type = 'final'), '')
from invoice_documents
where "orderId" = :'order_id';
SQL
)"

  invoice_result="$(psql_invoices "$postgres_pod" "$invoice_sql")"
  if [ -z "$invoice_result" ]; then
    missing_item "invoice evidence query returned a row for ORDER_ID"
    return
  fi

  IFS='|' read -r -a invoice_fields <<< "$invoice_result"
  PROFORMA_INVOICE_ID="${invoice_fields[2]:-}"
  FINAL_INVOICE_ID="${invoice_fields[3]:-}"
  if [ -z "$PAYMENT_APPLICATION_ID" ]; then
    PAYMENT_APPLICATION_ID="${invoice_fields[31]:-}"
  fi

  require_equal "${invoice_fields[0]:-0}" "1" "exactly one proforma invoice row for ORDER_ID"
  require_equal "${invoice_fields[1]:-0}" "1" "exactly one final invoice row for ORDER_ID"
  require_non_empty "$PROFORMA_INVOICE_ID" "proforma invoice id captured"
  require_non_empty "$FINAL_INVOICE_ID" "final invoice id captured"
  require_status_allowed "${invoice_fields[4]:-}" "proforma status is issuable"
  require_status_allowed "${invoice_fields[5]:-}" "final status is issuable"
  require_true "${invoice_fields[6]:-}" "proforma invoice number present"
  require_true "${invoice_fields[7]:-}" "final invoice number present"
  require_true "${invoice_fields[8]:-}" "proforma currency present"
  require_true "${invoice_fields[9]:-}" "final currency present"
  require_true "${invoice_fields[10]:-}" "proforma total amount present"
  require_true "${invoice_fields[11]:-}" "final total amount present"
  require_true "${invoice_fields[12]:-}" "proforma tax amount present"
  require_true "${invoice_fields[13]:-}" "final tax amount present"
  require_true "${invoice_fields[14]:-}" "proforma HTML snapshot present"
  require_true "${invoice_fields[15]:-}" "final HTML snapshot present"
  require_true "${invoice_fields[16]:-}" "proforma PDF snapshot present"
  require_true "${invoice_fields[17]:-}" "final PDF snapshot present"
  require_true "${invoice_fields[18]:-}" "proforma PDF SHA-256 present"
  require_true "${invoice_fields[19]:-}" "final PDF SHA-256 present"
  require_true "${invoice_fields[20]:-}" "proforma download token hash present"
  require_true "${invoice_fields[21]:-}" "final download token hash present"
  require_true "${invoice_fields[22]:-}" "proforma invoice is not blocked"
  require_true "${invoice_fields[23]:-}" "final invoice is not blocked"
  require_true "${invoice_fields[24]:-}" "proforma issuedAt present"
  require_true "${invoice_fields[25]:-}" "final issuedAt present"
  require_true "${invoice_fields[26]:-}" "final payment reference present"
  require_true "${invoice_fields[27]:-}" "final payment snapshot present"
  require_false_text "${invoice_fields[28]:-}" "stored final payment snapshot records providerCall=false"
  require_non_empty "$PAYMENT_APPLICATION_ID" "payment application id available from fixture or order snapshot"
}

check_event_rows() {
  local postgres_pod="$1"
  local event_sql event_result
  event_sql="$(cat <<'SQL'
select
  count(*) filter (where "eventType" = 'orders.order.created.v1' and status = 'processed'),
  count(*) filter (where "eventType" = 'orders.order.paid.v1' and status = 'processed'),
  count(*) filter (where status = 'failed'),
  count(*) filter (where status = 'skipped')
from invoice_event_records
where "orderId" = :'order_id';
SQL
)"
  event_result="$(psql_invoices "$postgres_pod" "$event_sql")"
  IFS='|' read -r -a event_fields <<< "$event_result"
  require_at_least "${event_fields[0]:-0}" "1" "at least one processed order-created event record"
  require_at_least "${event_fields[1]:-0}" "1" "at least one processed order-paid event record"
  require_equal "${event_fields[2]:-0}" "0" "no failed invoice event records for ORDER_ID"
}

check_internal_invoice_api() {
  local order_json proforma_html proforma_pdf final_html final_pdf
  order_json="$(new_tmp_file)"
  if curl_internal_json "${INVOICES_BASE_URL%/}/invoices/order/${ORDER_ID}" "$order_json"; then
    ok "internal invoices/order endpoint returned data"
  else
    missing_item "internal invoices/order endpoint returns data for ORDER_ID"
    return
  fi

  ORDER_JSON_FILE="$order_json" \
  PROFORMA_INVOICE_ID="$PROFORMA_INVOICE_ID" \
  FINAL_INVOICE_ID="$FINAL_INVOICE_ID" \
  node <<'NODE' || missing=1
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.env.ORDER_JSON_FILE, 'utf8'));
const rows = Array.isArray(payload.data) ? payload.data : [];
const byId = new Map(rows.map((row) => [row.id, row]));
const proforma = byId.get(process.env.PROFORMA_INVOICE_ID);
const final = byId.get(process.env.FINAL_INVOICE_ID);
let failed = false;
function check(condition, message) {
  if (condition) console.log(`OK: ${message}`);
  else {
    console.log(`[MISSING: ${message}]`);
    failed = true;
  }
}
check(Boolean(proforma), 'internal API returns the proforma invoice id');
check(Boolean(final), 'internal API returns the final invoice id');
check(proforma?.type === 'proforma', 'internal API proforma type is proforma');
check(final?.type === 'final', 'internal API final type is final');
check(!('documentHtml' in (proforma || {})), 'internal API list omits raw HTML documents');
check(!('documentPdf' in (final || {})), 'internal API list omits raw PDF documents');
check(!('downloadTokenHash' in (final || {})), 'internal API list omits token hashes');
process.exit(failed ? 1 : 0);
NODE

  proforma_html="$(new_tmp_file)"
  proforma_pdf="$(new_tmp_file)"
  final_html="$(new_tmp_file)"
  final_pdf="$(new_tmp_file)"
  check_internal_document "$PROFORMA_INVOICE_ID" "proforma" "$proforma_html" "$proforma_pdf"
  check_internal_document "$FINAL_INVOICE_ID" "final" "$final_html" "$final_pdf"
}

check_internal_document() {
  local invoice_id="$1"
  local label="$2"
  local html_path="$3"
  local pdf_path="$4"

  if curl_internal_json "${INVOICES_BASE_URL%/}/invoices/${invoice_id}/document.html" "$html_path"; then
    if grep -qi '<html' "$html_path"; then
      ok "internal ${label} HTML document is readable"
    else
      missing_item "internal ${label} HTML document contains HTML"
    fi
  else
    missing_item "internal ${label} HTML document is readable"
  fi

  if curl_internal_json "${INVOICES_BASE_URL%/}/invoices/${invoice_id}/document.pdf" "$pdf_path"; then
    local pdf_header pdf_size
    pdf_header="$(head -c 4 "$pdf_path" || true)"
    pdf_size="$(wc -c < "$pdf_path" | xargs)"
    if [ "$pdf_header" = "%PDF" ] && [ "${pdf_size:-0}" -gt 100 ]; then
      ok "internal ${label} PDF document is readable"
    else
      missing_item "internal ${label} PDF document is a non-empty PDF"
    fi
  else
    missing_item "internal ${label} PDF document is readable"
  fi
}

check_payments_status_api() {
  local api_key payments_json
  api_key="${PAYMENTS_API_KEY:-}"
  if [ -z "$api_key" ]; then
    api_key="$(read_secret_key "$INVOICES_SECRET_NAME" PAYMENTS_API_KEY)"
  fi
  if [ -z "$api_key" ]; then
    missing_item "PAYMENTS_API_KEY available for read-only payment status evidence"
    return
  fi

  payments_json="$(new_tmp_file)"
  if curl -fsS \
    -H "X-API-Key: ${api_key}" \
    "${PAYMENTS_BASE_URL%/}/payments/status/by-order-id?applicationId=${PAYMENT_APPLICATION_ID}&orderId=${ORDER_ID}" \
    -o "$payments_json"; then
    ok "Payments status snapshot endpoint returned data"
  else
    missing_item "Payments status snapshot endpoint returns fixture payment"
    return
  fi

  PAYMENTS_JSON_FILE="$payments_json" \
  ORDER_ID="$ORDER_ID" \
  PAYMENT_APPLICATION_ID="$PAYMENT_APPLICATION_ID" \
  node <<'NODE' || missing=1
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.env.PAYMENTS_JSON_FILE, 'utf8'));
const data = payload.data || payload;
let failed = false;
function check(condition, message) {
  if (condition) console.log(`OK: ${message}`);
  else {
    console.log(`[MISSING: ${message}]`);
    failed = true;
  }
}
check(payload.success === true, 'Payments status response has success=true');
check(data.orderId === process.env.ORDER_ID, 'Payments status response matches ORDER_ID');
check(data.applicationId === process.env.PAYMENT_APPLICATION_ID, 'Payments status response matches PAYMENT_APPLICATION_ID');
check(data.status === 'completed', 'Payments status is completed');
check(data.providerCall === false, 'Payments status evidence has providerCall=false');
check(data.mutation === false, 'Payments status evidence has mutation=false');
check(data.persistence === false, 'Payments status evidence has persistence=false');
process.exit(failed ? 1 : 0);
NODE
}

check_customer_account() {
  local account_json
  if [ -z "${CUSTOMER_BEARER_TOKEN:-}" ]; then
    if [ "$REQUIRE_CUSTOMER_ACCOUNT" = "true" ]; then
      missing_item "CUSTOMER_BEARER_TOKEN for customer account evidence"
    else
      info "customer account evidence skipped because CUSTOMER_BEARER_TOKEN is not set"
    fi
    return
  fi

  account_json="$(new_tmp_file)"
  if curl -fsS \
    -H "Authorization: Bearer ${CUSTOMER_BEARER_TOKEN}" \
    "${INVOICES_BASE_URL%/}/invoices/account" \
    -o "$account_json"; then
    ok "customer invoices/account endpoint returned data"
  else
    missing_item "customer invoices/account endpoint returns data"
    return
  fi

  CUSTOMER_ACCOUNT_JSON_FILE="$account_json" \
  PROFORMA_INVOICE_ID="$PROFORMA_INVOICE_ID" \
  FINAL_INVOICE_ID="$FINAL_INVOICE_ID" \
  node <<'NODE' || missing=1
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.env.CUSTOMER_ACCOUNT_JSON_FILE, 'utf8'));
const rows = Array.isArray(payload.data) ? payload.data : [];
const ids = new Set(rows.map((row) => row.id));
let failed = false;
function check(condition, message) {
  if (condition) console.log(`OK: ${message}`);
  else {
    console.log(`[MISSING: ${message}]`);
    failed = true;
  }
}
check(ids.has(process.env.PROFORMA_INVOICE_ID), 'customer account includes proforma invoice');
check(ids.has(process.env.FINAL_INVOICE_ID), 'customer account includes final invoice');
check(rows.every((row) => !('orderSnapshot' in row)), 'customer account omits order snapshots');
check(rows.every((row) => !('documentHtml' in row)), 'customer account omits raw HTML');
check(rows.every((row) => !('downloadTokenHash' in row)), 'customer account omits token hashes');
process.exit(failed ? 1 : 0);
NODE
}

check_download_link_rotation() {
  local link_json curl_config output_pdf
  if [ "$VERIFY_DOWNLOAD_LINK_ROTATION" != "true" ]; then
    info "download-link rotation skipped by default because it mutates token state"
    return
  fi
  if [ "$FINAL_SMOKE_APPROVED" != "true" ]; then
    missing_item "FINAL_SMOKE_APPROVED=true before download-link rotation"
    return
  fi

  link_json="$(new_tmp_file)"
  if curl -fsS -X POST \
    -H "x-internal-service-token: ${INVOICES_INTERNAL_SERVICE_TOKEN}" \
    "${INVOICES_BASE_URL%/}/invoices/${FINAL_INVOICE_ID}/download-link" \
    -o "$link_json"; then
    ok "internal final download-link rotation returned data"
  else
    missing_item "internal final download-link rotation returned data"
    return
  fi

  LINK_JSON_FILE="$link_json" \
  node <<'NODE' || missing=1
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.env.LINK_JSON_FILE, 'utf8'));
const data = payload.data || {};
let failed = false;
function check(condition, message) {
  if (condition) console.log(`OK: ${message}`);
  else {
    console.log(`[MISSING: ${message}]`);
    failed = true;
  }
}
check(typeof data.htmlUrl === 'string' && data.htmlUrl.startsWith('https://') && data.htmlUrl.includes('token='), 'download link response includes tokenized HTTPS HTML URL');
check(typeof data.pdfUrl === 'string' && data.pdfUrl.startsWith('https://') && data.pdfUrl.includes('token='), 'download link response includes tokenized HTTPS PDF URL');
check(!('downloadTokenHash' in data), 'download link response omits token hash');
process.exit(failed ? 1 : 0);
NODE

  if [ "$VERIFY_PUBLIC_LINKS" != "true" ]; then
    info "public URL dereference skipped; set VERIFY_PUBLIC_LINKS=true to fetch the rotated PDF URL"
    return
  fi

  curl_config="$(new_tmp_file)"
  output_pdf="$(new_tmp_file)"
  LINK_JSON_FILE="$link_json" CURL_CONFIG="$curl_config" OUTPUT_PDF="$output_pdf" node <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.env.LINK_JSON_FILE, 'utf8'));
const url = payload.data?.pdfUrl;
if (!url) process.exit(1);
const escapedUrl = url.replace(/"/g, '\\"');
const escapedOutput = process.env.OUTPUT_PDF.replace(/"/g, '\\"');
fs.writeFileSync(process.env.CURL_CONFIG, `url = "${escapedUrl}"\noutput = "${escapedOutput}"\n`);
NODE
  if curl -fsS --config "$curl_config"; then
    local pdf_header
    pdf_header="$(head -c 4 "$output_pdf" || true)"
    if [ "$pdf_header" = "%PDF" ]; then
      ok "tokenized public final PDF URL is readable"
    else
      missing_item "tokenized public final PDF URL returns a PDF"
    fi
  else
    missing_item "tokenized public final PDF URL is readable"
  fi
}

check_logging_evidence() {
  local logs_json
  if [ -z "${LOGGING_ADMIN_BEARER_TOKEN:-}" ]; then
    if [ "$REQUIRE_LOGGING_EVIDENCE" = "true" ]; then
      missing_item "LOGGING_ADMIN_BEARER_TOKEN for logging evidence"
    else
      info "logging evidence skipped because LOGGING_ADMIN_BEARER_TOKEN is not set"
    fi
    return
  fi

  logs_json="$(new_tmp_file)"
  if curl -fsS \
    -H "Authorization: Bearer ${LOGGING_ADMIN_BEARER_TOKEN}" \
    "${LOGGING_BASE_URL%/}/api/logs/query?service=invoices-microservice&limit=100" \
    -o "$logs_json"; then
    ok "Logging query returned invoices service logs"
  else
    missing_item "Logging query returns invoices service logs"
    return
  fi

  LOGS_JSON_FILE="$logs_json" node <<'NODE' || missing=1
const fs = require('fs');
const text = fs.readFileSync(process.env.LOGS_JSON_FILE, 'utf8');
let failed = false;
function check(condition, message) {
  if (condition) console.log(`OK: ${message}`);
  else {
    console.log(`[MISSING: ${message}]`);
    failed = true;
  }
}
check(text.includes('Invoice issued'), 'Logging evidence includes Invoice issued records');
check(text.includes('proforma'), 'Logging evidence includes proforma invoice type');
check(text.includes('final'), 'Logging evidence includes final invoice type');
check(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text), 'Logging evidence output does not include email addresses');
check(!/(token|secret|password|authorization)["'=:\s]+[^"',\s}]+/i.test(text), 'Logging evidence output does not include obvious secret assignments');
process.exit(failed ? 1 : 0);
NODE
}

printf 'Invoices final smoke evidence check\n'
printf 'Namespace: %s | DB: %s | Invoices URL: %s | Payments URL: %s\n' \
  "$NAMESPACE" "$INVOICES_DB_NAME" "$INVOICES_BASE_URL" "$PAYMENTS_BASE_URL"

require_non_empty "$ORDER_ID" "ORDER_ID for final smoke evidence"
if [ "$missing" -ne 0 ]; then
  printf 'Final smoke evidence check failed before runtime reads\n'
  exit 1
fi

require_command kubectl || true
require_command curl || true
require_command node || true
if [ "$missing" -ne 0 ]; then
  printf 'Final smoke evidence check failed before runtime reads\n'
  exit 1
fi

if [ "$SKIP_FINAL_SMOKE_PREREQS" != "true" ]; then
  printf 'Checking final-smoke prerequisites before evidence capture...\n'
  if bash "${SCRIPT_DIR}/check-final-smoke-prereqs.sh"; then
    ok "final smoke prerequisites pass"
  else
    missing_item "final smoke prerequisites pass before evidence capture"
    printf 'Final smoke evidence check failed before DB/API reads\n'
    exit 1
  fi
else
  info "final-smoke prerequisite check skipped by SKIP_FINAL_SMOKE_PREREQS=true"
fi

postgres_pod="$(find_postgres_pod)"
if [ -z "$postgres_pod" ]; then
  missing_item "running Postgres pod matching ${POSTGRES_MATCH} in namespace ${NAMESPACE}"
  printf 'Final smoke evidence check failed before DB reads\n'
  exit 1
fi
ok "running Postgres pod found"

check_invoice_rows "$postgres_pod"
check_event_rows "$postgres_pod"

INVOICES_INTERNAL_SERVICE_TOKEN="${INVOICES_INTERNAL_SERVICE_TOKEN:-}"
if [ -z "$INVOICES_INTERNAL_SERVICE_TOKEN" ]; then
  INVOICES_INTERNAL_SERVICE_TOKEN="$(read_secret_key "$INVOICES_SECRET_NAME" INVOICES_INTERNAL_SERVICE_TOKEN)"
fi
if [ -n "$INVOICES_INTERNAL_SERVICE_TOKEN" ]; then
  ok "internal invoices token is available for evidence calls"
  check_internal_invoice_api
else
  missing_item "INVOICES_INTERNAL_SERVICE_TOKEN available for internal evidence calls"
fi

check_payments_status_api
check_customer_account
check_download_link_rotation
check_logging_evidence

if [ "$missing" -ne 0 ]; then
  printf 'Final smoke evidence check failed\n'
  exit 1
fi

printf 'Final smoke evidence check passed\n'
