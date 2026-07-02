#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-statex-apps}"
POSTGRES_DEPLOYMENT="${POSTGRES_DEPLOYMENT:-deploy/db-server-postgres}"
RABBITMQ_POD="${RABBITMQ_POD:-rabbitmq-0}"
ORDERS_DB_NAME="${ORDERS_DB_NAME:-orders}"
PAYMENTS_DB_NAME="${PAYMENTS_DB_NAME:-payment}"
INVOICES_DB_NAME="${INVOICES_DB_NAME:-invoices}"
ORDERS_EXCHANGE="${ORDERS_EXCHANGE:-orders.events}"
FINAL_SMOKE_APPROVED="${FINAL_SMOKE_APPROVED:-false}"
FIXTURE_CHANNEL="${FIXTURE_CHANNEL:-invoices-final-smoke}"
PAYMENT_APPLICATION_ID="${PAYMENT_APPLICATION_ID:-statex}"

if [ "$FINAL_SMOKE_APPROVED" != "true" ]; then
  printf '[MISSING: FINAL_SMOKE_APPROVED=true before creating synthetic final smoke fixture]\n'
  exit 1
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[MISSING: required command %s is unavailable]\n' "$1"
    exit 1
  fi
}

require_command kubectl
require_command node

ORDER_ID="$(node -e 'console.log(crypto.randomUUID())')"
PAYMENT_ID="$(node -e 'console.log(crypto.randomUUID())')"
ITEM_ID="$(node -e 'console.log(crypto.randomUUID())')"
TRANSACTION_ID="$(node -e 'console.log(crypto.randomUUID())')"
ORDER_EXTERNAL_ID="invoices-final-smoke-${ORDER_ID}"
NOW="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

psql_db() {
  local db_name="$1"
  kubectl -n "$NAMESPACE" exec -i "$POSTGRES_DEPLOYMENT" -- psql -v ON_ERROR_STOP=1 -U dbadmin -d "$db_name"
}

publish_event() {
  local routing_key="$1"
  local payload="$2"
  kubectl -n "$NAMESPACE" exec -i "$RABBITMQ_POD" -- rabbitmqadmin publish \
    exchange="$ORDERS_EXCHANGE" \
    routing_key="$routing_key" \
    payload="$payload" \
    properties='{"delivery_mode":2}' >/dev/null
}

cleanup_fixture() {
  set +e
  psql_db "$INVOICES_DB_NAME" <<SQL >/dev/null 2>&1
delete from invoice_event_records where "orderId" = '${ORDER_ID}';
delete from invoice_documents where "orderId" = '${ORDER_ID}';
SQL
  psql_db "$PAYMENTS_DB_NAME" <<SQL >/dev/null 2>&1
delete from payment_transactions where "paymentId" = '${PAYMENT_ID}';
delete from payments where id = '${PAYMENT_ID}';
SQL
  psql_db "$ORDERS_DB_NAME" <<SQL >/dev/null 2>&1
delete from order_items where order_id = '${ORDER_ID}';
delete from orders where id = '${ORDER_ID}';
SQL
}

trap cleanup_fixture ERR

psql_db "$ORDERS_DB_NAME" <<SQL >/dev/null
insert into orders (
  id,
  "externalOrderId",
  channel,
  "channelAccountId",
  status,
  customer,
  "shippingAddress",
  "billingAddress",
  subtotal,
  "shippingCost",
  "taxAmount",
  total,
  currency,
  "paymentMethod",
  "paymentStatus",
  "paymentReferenceId",
  "paymentApplicationId",
  "paymentUpdatedAt",
  "shippingMethod",
  "customerNote",
  "internalNote",
  "warehouseHandoff",
  "orderedAt",
  "createdAt",
  "updatedAt"
) values (
  '${ORDER_ID}',
  '${ORDER_EXTERNAL_ID}',
  '${FIXTURE_CHANNEL}',
  'invoices-final-smoke',
  'pending',
  '{"name":"Synthetic Invoice Smoke Buyer","authUserId":"invoices-final-smoke-subject"}'::jsonb,
  '{"name":"Synthetic Invoice Smoke Buyer","street":"Testova 1","city":"Praha","postalCode":"11000","country":"CZ"}'::jsonb,
  '{"name":"Synthetic Invoice Smoke Buyer","street":"Testova 1","city":"Praha","postalCode":"11000","country":"CZ","companyName":"Synthetic Invoice Smoke Buyer"}'::jsonb,
  100.00,
  0.00,
  21.00,
  121.00,
  'CZK',
  'invoice',
  'pending',
  null,
  '${PAYMENT_APPLICATION_ID}',
  null,
  'synthetic',
  null,
  'synthetic invoices final smoke fixture',
  '{"status":"synthetic_no_warehouse_mutation","skipReason":"invoices_final_smoke_fixture"}'::jsonb,
  '${NOW}',
  now(),
  now()
);

insert into order_items (
  id,
  order_id,
  "productId",
  sku,
  title,
  quantity,
  "unitPrice",
  "totalPrice",
  "fulfillmentStatus",
  "warehouseId",
  "createdAt"
) values (
  '${ITEM_ID}',
  '${ORDER_ID}',
  'invoices-final-smoke-product',
  'INV-SMOKE-001',
  'Synthetic invoice smoke item',
  1,
  100.00,
  100.00,
  'pending',
  null,
  now()
);
SQL

CREATED_EVENT="$(ORDER_ID="$ORDER_ID" FIXTURE_CHANNEL="$FIXTURE_CHANNEL" node -e '
const event = {
  type: "orders.order.created.v1",
  eventVersion: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  source: "orders-microservice",
  payload: {
    orderId: process.env.ORDER_ID,
    channel: process.env.FIXTURE_CHANNEL,
    currency: "CZK",
    items: [{
      productId: "invoices-final-smoke-product",
      sku: "INV-SMOKE-001",
      quantity: 1,
      unitPrice: 100,
      totalPrice: 100
    }]
  }
};
process.stdout.write(JSON.stringify(event));
')"
ORDER_ID="$ORDER_ID" FIXTURE_CHANNEL="$FIXTURE_CHANNEL" publish_event "orders.order.created.v1" "$CREATED_EVENT"

sleep "${FIXTURE_SETTLE_SECONDS:-5}"

psql_db "$PAYMENTS_DB_NAME" <<SQL >/dev/null
insert into payments (
  id,
  "orderId",
  "applicationId",
  amount,
  currency,
  "paymentMethod",
  status,
  "providerTransactionId",
  "redirectUrl",
  "callbackUrl",
  metadata,
  "createdAt",
  "updatedAt",
  "completedAt",
  "refundedAt"
) values (
  '${PAYMENT_ID}',
  '${ORDER_ID}',
  '${PAYMENT_APPLICATION_ID}',
  121.00,
  'CZK',
  'invoice',
  'completed',
  null,
  null,
  'https://invalid.local/invoices-final-smoke/callback',
  '{"fixture":"invoices-final-smoke","providerCall":false,"customerContact":false}'::jsonb,
  now(),
  now(),
  now(),
  null
);

insert into payment_transactions (
  id,
  "paymentId",
  "transactionType",
  amount,
  status,
  "providerResponse",
  "createdAt"
) values (
  '${TRANSACTION_ID}',
  '${PAYMENT_ID}',
  'payment',
  121.00,
  'success',
  '{"fixture":"invoices-final-smoke","providerCall":false}'::jsonb,
  now()
);
SQL

psql_db "$ORDERS_DB_NAME" <<SQL >/dev/null
update orders
set
  status = 'confirmed',
  "paymentStatus" = 'paid',
  "paymentReferenceId" = '${PAYMENT_ID}',
  "paymentApplicationId" = '${PAYMENT_APPLICATION_ID}',
  "paymentUpdatedAt" = now(),
  "updatedAt" = now()
where id = '${ORDER_ID}';
SQL

PAID_EVENT="$(ORDER_ID="$ORDER_ID" PAYMENT_ID="$PAYMENT_ID" node -e '
const event = {
  type: "orders.order.paid.v1",
  eventVersion: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  source: "orders-microservice",
  payload: {
    orderId: process.env.ORDER_ID,
    paymentStatus: "paid",
    paymentReferenceId: process.env.PAYMENT_ID
  }
};
process.stdout.write(JSON.stringify(event));
')"
ORDER_ID="$ORDER_ID" PAYMENT_ID="$PAYMENT_ID" publish_event "orders.order.paid.v1" "$PAID_EVENT"

printf 'Synthetic invoices final smoke fixture created\n'
printf 'ORDER_ID=%s\n' "$ORDER_ID"
printf 'PAYMENT_APPLICATION_ID=%s\n' "$PAYMENT_APPLICATION_ID"
printf 'PAYMENT_ID=%s\n' "$PAYMENT_ID"
