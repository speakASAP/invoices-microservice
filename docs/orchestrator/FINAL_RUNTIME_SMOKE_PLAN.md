# Final Runtime Smoke Plan: Invoices Workflow

Status: dependency-gated.
Owner lane: final integration/runtime smoke.
Repository: `/home/ssf/Documents/Github/invoices-microservice`.
Prepared: 2026-07-02.

This runbook is non-mutating by default. Do not deploy, scale, create orders,
trigger payments, write secrets, write databases, send notifications, or contact
customers from this lane until the orchestrator records explicit approval after
the runtime blockers below are resolved.

## Intent Preservation Chain

- Vision: every eligible order has one proforma invoice on order creation and
  one final tax invoice on payment completion.
- Goal Impact: prove the live workflow without moving ownership from Orders,
  Payments, Notifications, Logging, or Auth into Invoices.
- System: `invoices-microservice` consumes safe Orders lifecycle triggers,
  fetches authorized order/payment snapshots, renders invoice documents, exposes
  guarded document access, and emits sanitized logs.
- Feature: final runtime smoke for created-order proforma, paid-order final
  invoice, account/customer document access, and logging evidence.
- Task: prepare the smoke lane, gates, fixture requirements, evidence commands,
  blockers, and rollback/no-op constraints.
- Execution Plan: run read-only gates now; execute live fixture steps only after
  runtime provisioning and delivery readiness are approved.
- Coding Prompt: no source/runtime mutation in this lane except this runbook.
- Code: `docs/orchestrator/FINAL_RUNTIME_SMOKE_PLAN.md`.
- Validation: source verifiers and read-only runtime preflight listed below.

## Current Read-Only Evidence

Collected on 2026-07-02 over `ssh alfares`.

- `invoices-microservice`: source checkpoint before this runbook was
  `6ef36a4 docs: refresh invoices integration orchestration state`; repo was
  ahead of origin by 1 commit.
- `notifications-microservice`: clean `main`, ahead of origin by 2 commits,
  `676b662 test: define invoices notification readiness contract` on top of
  `8a6b7ed feat: allow invoices notifications service actor`.
- `npm run verify:contracts`: passed in `invoices-microservice`.
- `npm run verify:runtime-readiness`: passed in `invoices-microservice`.
- `npm run verify:runtime-prereqs`: failed as expected:
  - `[MISSING: Vault path secret/prod/invoices-microservice]`
  - `[MISSING: database invoices]`
  - Orders ready `1/1`.
  - Payments ready `1/1`.
  - Notifications ready `1/1`.
  - Logging ready `1/1`.
  - RabbitMQ ready `1/1`.
- Orders verifier: `npm run verify:invoices-read-boundary` passed.
- Orders verifier: `npm run verify:event-contracts` passed.
- Payments focused tests:
  `npm test -- --runTestsByPath test/payment-status-snapshot.spec.ts test/payments-orders-status-bridge.spec.ts`
  passed, 2 suites / 14 tests.
- Notifications contract validation:
  `bash -n scripts/check-invoices-documents-readiness.sh` passed.
- Notifications focused tests:
  `npm test -- --runTestsByPath src/auth/jwt-roles.guard.spec.ts src/notifications/channel-registry.service.spec.ts src/notifications/notifications.service.spec.ts`
  passed in the delivery lane; that lane's full validation passed 7 suites /
  31 tests.
- K8s read-only workload state:
  - `orders-microservice`: desired `1`, ready `1`.
  - `payments-microservice`: desired `1`, ready `1`.
  - `notifications-microservice`: desired `1`, ready `1`.
  - `logging-microservice`: desired `1`, ready `1`.
  - `rabbitmq`: desired `1`, ready `1`.

## Dependency Gates

The smoke remains blocked until all gates are closed.

1. Runtime prerequisites pass:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:runtime-prereqs'
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:final-smoke-prereqs'
   ```

2. Vault path `secret/prod/invoices-microservice` exists with these key names
   only verified by presence, never printed:
   - `DB_PASSWORD`
   - `INVOICES_INTERNAL_SERVICE_TOKEN`
   - `ORDERS_SERVICE_TOKEN`
   - `PAYMENTS_API_KEY`
   - `NOTIFICATIONS_SERVICE_TOKEN`

3. Database gate:
   - Preferred: `invoices` database already exists.
   - Alternative: owner explicitly approves first deploy with
     `DB_AUTO_CREATE=true`; production ConfigMap currently keeps
     `DB_AUTO_CREATE=false`.

4. Workload gate:
   - `orders-microservice`, `payments-microservice`,
     `notifications-microservice`, `logging-microservice`, and `rabbitmq` all
     have desired replicas greater than zero and ready replicas equal to desired.

5. Invoices deployment gate:
   - `invoices-microservice` is deployed and healthy.
   - `ORDERS_EVENTS_CONSUMER_ENABLED=true` is explicitly approved for the final
     RabbitMQ integration smoke. The source manifest currently defaults it to
     `false` so deploys fail closed.
   - `INVOICES_PUBLIC_BASE_URL=https://invoices.alfares.cz` resolves through the
     deployed ingress.

6. Issuance/legal gate:
   - Seller legal secret is present in `invoices-microservice-seller-secret`.
   - If missing, service startup may still be allowed, but invoice issuance must
     fail closed with `seller_legal_config_missing`.

7. Notifications delivery gate:
   - Notifications runtime includes the `8a6b7ed` service-identity change and
     `676b662` no-send readiness contract, or equivalent.
   - `secret/prod/invoices-microservice#NOTIFICATIONS_SERVICE_TOKEN` is projected
     into Notifications as `INVOICES_NOTIFICATIONS_SERVICE_TOKEN`.
   - Runtime `invoices.documents` channel policy currently allows
     `invoices-microservice` with `transactional` purpose.
   - No real notification send is allowed without explicit approval and an
     approved internal recipient.

8. Account identity gate:
   - Account access prefers a stable Auth subject when the stored Orders
     snapshot includes `customer.id`, `customer.authUserId`, `customer.subject`,
     `customer.sub`, `customerId`, `customerUserId`, `authUserId`, or `userId`.
   - Legacy account access still falls back to `orderSnapshot.customer.email`.
   - `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`

9. Document storage gate:
   - Current smoke acceptance can use DB-backed immutable PDF bytes and
     tokenized PDF links.
   - The selected off-database contract is MinIO/S3-backed immutable PDF
     objects owned by invoices.
   - Runtime MinIO/S3 storage is not required for first DB-backed smoke, but it
     is required before moving large/long-retention tax documents out of the
     invoices database.
   - `[MISSING: runtime MinIO/S3 invoice document bucket, credentials, retention policy, DB object-reference migration, upload/presign client, and backfill/rollback plan]`

10. Payments central-order gate:
   - Invoices Vault has `PAYMENTS_API_KEY`.
   - Payments runtime registers that key in `API_KEYS`/
     `PAYMENT_API_KEY_SCOPES` with `payments:read` scope.
   - The fixture payment must use a central Orders UUID as `orderId`.
   - `[MISSING: proof that all active checkout/payment paths pass central Orders UUIDs to Payments]`

## Required Fixture Data

Use only a synthetic, owner-approved fixture. Do not use a real customer order.

- `ORDER_ID`: central Orders UUID returned by Orders after fixture creation.
- `ORDER_CHANNEL`: approved synthetic channel, for example `flipflop` only if
  that channel is owner-approved for this smoke.
- `CUSTOMER_EMAIL`: test Auth account email matching the Orders snapshot
  `customer.email` for legacy fallback. Use an internal test mailbox only.
- `CUSTOMER_AUTH_SUBJECT`: Auth subject expected in the Orders snapshot for
  subject-first account access when the producer contract is available.
- `CUSTOMER_BEARER_TOKEN`: Auth bearer token for the test account. Do not print.
- Buyer data in the Orders snapshot:
  - buyer display name or company name.
  - billing street, city, country.
  - currency, subtotal, tax, total.
  - at least one item with product id, quantity, and price.
- Seller legal data in the seller secret:
  - `INVOICE_SELLER_NAME`
  - `INVOICE_SELLER_ADDRESS`
  - optional company/tax/VAT/email fields if legally required.
- Payment data:
  - `PAYMENT_APPLICATION_ID` matching the Payments record.
  - central `ORDER_ID` as the payment `orderId`.
  - completed status owned by Payments.
  - bounded `paymentReferenceId`, no provider raw payload.
- Notification data, only after delivery approval:
  - `channelKey=invoices.documents`
  - `service=invoices-microservice`
  - `purpose=transactional`
  - recipient is the internal test mailbox, not a real customer.

## Smoke Cases

### Case 0: Read-Only Gate Check

Run before any mutation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:contracts'
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:runtime-readiness'
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:runtime-prereqs'
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:final-smoke-prereqs'
ssh alfares 'cd /home/ssf/Documents/Github/orders-microservice && npm run verify:invoices-read-boundary'
ssh alfares 'cd /home/ssf/Documents/Github/orders-microservice && npm run verify:event-contracts'
ssh alfares 'cd /home/ssf/Documents/Github/payments-microservice && npm test -- --runTestsByPath test/payment-status-snapshot.spec.ts test/payments-orders-status-bridge.spec.ts'
ssh alfares 'cd /home/ssf/Documents/Github/notifications-microservice && bash -n scripts/check-invoices-documents-readiness.sh'
ssh alfares 'cd /home/ssf/Documents/Github/notifications-microservice && npm test -- --runTestsByPath src/auth/jwt-roles.guard.spec.ts src/notifications/channel-registry.service.spec.ts src/notifications/notifications.service.spec.ts'
```

Expected result: all source checks pass, `verify:runtime-prereqs` passes, and
`verify:final-smoke-prereqs` passes. Current live state has
`verify:runtime-prereqs` passing while `verify:final-smoke-prereqs` still fails
closed on consumer switch and seller legal secret. Invoices deployment, public
base URL, Payments key scope, Notifications token, Notifications channel policy,
and Notifications no-send validation gates pass. If either runtime verifier
fails in the final run, stop.

Before enabling the Orders consumer, run:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:seller-legal-source'
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run runtime:sync-seller-legal'
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:consumer-enable-prereqs'
```

The seller commands require the dedicated Vault path
`secret/prod/invoices-microservice-seller` with approved, non-placeholder legal
values and do not print those values. The consumer-enable prerequisite command
allows `ORDERS_EVENTS_CONSUMER_ENABLED=false` but still requires seller legal
data and all other final-smoke gates. After it passes, enable the
consumer only through:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run runtime:enable-orders-consumer'
```

After the approved synthetic fixture has created the central Orders UUID and
Payments has completed the matching fixture payment, capture automated
evidence without printing secrets, raw customer snapshots, document bodies, PDF
bytes, or token hashes:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && ORDER_ID="<ORDER_ID>" PAYMENT_APPLICATION_ID="<PAYMENT_APPLICATION_ID>" npm run verify:final-smoke-evidence'
```

`verify:final-smoke-evidence` is read-only by default. It runs
`verify:final-smoke-prereqs`, checks the `invoice_documents` and
`invoice_event_records` rows for exactly one proforma and one final invoice,
checks internal invoice list/document endpoints, verifies the final payment
snapshot through Payments read-only status evidence with `providerCall=false`,
and optionally checks customer account and Logging evidence when
`CUSTOMER_BEARER_TOKEN` or `LOGGING_ADMIN_BEARER_TOKEN` are supplied. Download
link rotation is a durable token-state mutation, so it is skipped unless
`VERIFY_DOWNLOAD_LINK_ROTATION=true` and `FINAL_SMOKE_APPROVED=true` are both
set.

### Case 1: Order Created Creates Proforma

Allowed only after approval to create the synthetic order.

Trigger:
- Create one synthetic order through the approved Orders create path.
- Do not publish a hand-crafted RabbitMQ event as the primary acceptance path.
- The accepted runtime signal is Orders publishing
  `orders.order.created.v1` on `orders.events`.

Expected event envelope:

```json
{
  "type": "orders.order.created.v1",
  "eventVersion": 1,
  "source": "orders-microservice",
  "payload": {
    "orderId": "<ORDER_ID>",
    "channel": "<ORDER_CHANNEL>",
    "currency": "CZK"
  }
}
```

Expected invoices evidence:
- One `invoice_documents` row for `ORDER_ID` and `type='proforma'`.
- `status` is `delivery_pending` when notification delivery is not approved or
  unavailable, or `sent` only when approved Notifications delivery succeeds.
- `invoiceNumber` is allocated.
- `documentHtml` is present.
- `documentPdf` is present and `documentPdfSha256` is populated.
- `downloadTokenHash` is present but not printed.
- `blockedReason` is null.
- One `invoice_event_records` row for the created event with `status='processed'`.
- Logging has a sanitized `Invoice issued` record with `invoiceType=proforma`.

### Case 2: Payment Completed Creates Final Tax Invoice

Allowed only after approval to complete or simulate the fixture payment through
the approved Payments/Orders path.

Trigger:
- Payments records terminal `completed` for the fixture payment using central
  `ORDER_ID`.
- Payments reports to Orders through
  `PUT /api/orders/:id/payment-status`.
- Orders publishes `orders.order.paid.v1` only when the previous status was not
  already paid.

Expected event envelope:

```json
{
  "type": "orders.order.paid.v1",
  "eventVersion": 1,
  "source": "orders-microservice",
  "payload": {
    "orderId": "<ORDER_ID>",
    "paymentStatus": "paid",
    "paymentReferenceId": "<PAYMENT_REFERENCE_ID>"
  }
}
```

Expected invoices evidence:
- Existing proforma row remains unchanged except delivery metadata if approved.
- One `invoice_documents` row for `ORDER_ID` and `type='final'`.
- `paymentReferenceId` is populated from the event or order snapshot.
- `paymentSnapshot` is present when Payments snapshot lookup succeeds; if it is
  null, log the snapshot blocker and keep the invoice issuance decision explicit.
- `documentHtml`, `documentPdf`, `documentPdfSha256`, and
  `downloadTokenHash` are present.
- `blockedReason` is null.
- One `invoice_event_records` row for the paid event with `status='processed'`.
- Logging has a sanitized `Invoice issued` record with `invoiceType=final`.

### Case 3: Internal And Public Document Access

Allowed only after invoices exist.

Use environment variables in the shell; do not echo token values.

```bash
INVOICES_URL='https://invoices.alfares.cz'
ORDER_ID='<ORDER_ID>'
INVOICE_ID='<INVOICE_ID>'

curl -fsS \
  -H "x-internal-service-token: ${INVOICES_INTERNAL_SERVICE_TOKEN:?}" \
  "${INVOICES_URL}/invoices/order/${ORDER_ID}"

curl -fsS \
  -H "x-internal-service-token: ${INVOICES_INTERNAL_SERVICE_TOKEN:?}" \
  "${INVOICES_URL}/invoices/${INVOICE_ID}/document.html" \
  -o /tmp/invoice-document-smoke.html

curl -fsS \
  -H "x-internal-service-token: ${INVOICES_INTERNAL_SERVICE_TOKEN:?}" \
  "${INVOICES_URL}/invoices/${INVOICE_ID}/document.pdf" \
  -o /tmp/invoice-document-smoke.pdf

curl -fsS -X POST \
  -H "x-internal-service-token: ${INVOICES_INTERNAL_SERVICE_TOKEN:?}" \
  "${INVOICES_URL}/invoices/${INVOICE_ID}/download-link"
```

Expected result:
- Internal order invoice listing returns proforma and final rows.
- Internal document endpoints return HTML and PDF.
- Download-link rotation returns HTML and PDF public URLs and does not expose
  the token hash.
- Public document URLs return HTML/PDF only with the returned opaque token.
- Public document URLs without token, with a wrong token, or with a stale token
  return forbidden.

### Case 4: Customer Account Access

Allowed only with the approved test Auth account.

```bash
INVOICES_URL='https://invoices.alfares.cz'
INVOICE_ID='<INVOICE_ID>'

curl -fsS \
  -H "Authorization: Bearer ${CUSTOMER_BEARER_TOKEN:?}" \
  "${INVOICES_URL}/invoices/account"

curl -fsS -X POST \
  -H "Authorization: Bearer ${CUSTOMER_BEARER_TOKEN:?}" \
  "${INVOICES_URL}/invoices/account/${INVOICE_ID}/download-link"
```

Expected result:
- Account list returns only invoices whose stored
  `orderSnapshot.customer.email` matches the Auth-validated customer email.
- Response omits raw order snapshot, document HTML, token hashes, billing
  address, customer address, blocked internals, and source event internals.
- Customer download-link rotation returns public HTML and PDF URLs for matching
  invoices.
- A different test Auth account must not see or rotate the invoice.

### Case 5: Logging Evidence

Allowed after smoke execution. Query requires a logging admin token.

```bash
LOGGING_URL='https://logging.alfares.cz'

curl -fsS \
  -H "Authorization: Bearer ${LOGGING_ADMIN_BEARER_TOKEN:?}" \
  "${LOGGING_URL}/api/logs/query?service=invoices-microservice&limit=50"
```

Expected result:
- Logs include sanitized `Orders events consumer started` after consumer enable.
- Logs include sanitized `Invoice issued` for proforma and final.
- If notification delivery is unavailable or disabled, logs may include
  sanitized notification failure/skip context, not raw recipient data.
- Logs must not include tokens, raw email addresses, billing addresses, provider
  payloads, or raw customer data.

## Database Evidence Commands

Run only after the `invoices` database exists and the smoke fixture is approved.
Do not print customer snapshot JSON.

```bash
ORDER_ID='<ORDER_ID>'
POSTGRES_POD='<running db-server-postgres pod>'

ssh alfares "kubectl exec -n statex-apps ${POSTGRES_POD} -- sh -lc \
  'psql -U \"\$POSTGRES_USER\" -d invoices -tAc \"select type,status,\\\"invoiceNumber\\\",currency,\\\"totalAmount\\\",\\\"taxAmount\\\",\\\"paymentReferenceId\\\",(\\\"documentHtml\\\" is not null) as has_html,(\\\"documentPdf\\\" is not null) as has_pdf,\\\"documentPdfSha256\\\",(\\\"downloadTokenHash\\\" is not null) as has_token,\\\"blockedReason\\\",\\\"issuedAt\\\",\\\"sentAt\\\" from invoice_documents where \\\"orderId\\\" = '\''${ORDER_ID}'\'' order by type;\"'"

ssh alfares "kubectl exec -n statex-apps ${POSTGRES_POD} -- sh -lc \
  'psql -U \"\$POSTGRES_USER\" -d invoices -tAc \"select \\\"eventType\\\",status,\\\"orderId\\\",\\\"processedAt\\\" from invoice_event_records where \\\"orderId\\\" = '\''${ORDER_ID}'\'' order by \\\"processedAt\\\";\"'"
```

Expected result:
- Exactly two invoice rows for `ORDER_ID`: `proforma` and `final`.
- Exactly two processed event rows for created and paid events.
- No raw `orderSnapshot`, `paymentSnapshot`, `documentHtml`, `documentPdf`, or
  token hash is printed in smoke evidence.

## Rollback And No-Op Constraints

- Before runtime prerequisites pass, the only allowed commands are read-only
  source checks, K8s status reads, Vault key-presence checks, and docs updates.
- Do not run `./scripts/deploy.sh` from this lane unless the orchestrator has
  approved deployment after the gates close.
- Do not scale Orders, Payments, Notifications, or Invoices from this lane.
- Do not set Vault values or create the `invoices` database from this lane.
- Do not use a real customer email, real payment provider flow, real customer
  mailbox, or production provider dashboard.
- Do not publish hand-crafted lifecycle events as acceptance evidence. Manual
  `POST /invoices/events/orders` is a debugging fallback only, not final
  end-to-end acceptance.
- Do not delete invoice rows after smoke unless a separately approved cleanup
  policy exists. If production is used, fixture rows should remain auditable and
  clearly traceable to the approved synthetic order.
- If any invoice is `blocked`, stop and record `blockedReason`; do not patch DB
  rows to force success.

## Parallel Coordination

| Workstream | Status | Owner | Dependency | Handoff |
| --- | --- | --- | --- | --- |
| Final smoke design | dependency-gated | final smoke lane | runtime gates | This runbook |
| Runtime provisioning | partially-complete | platform/secrets owner | Vault, DB, scaling, invoices deployment, guarded consumer switch | `verify:runtime-prereqs` passes; invoices is deployed; final smoke still waits on legal/consumer gates |
| Notifications delivery | complete-for-no-send | notifications owner | token projection, channel row | `invoices.documents` policy and no-send validation pass |
| Orders/Payments fixture | dependency-gated | orchestrator | approved synthetic order/payment | Provide `ORDER_ID`, `PAYMENT_APPLICATION_ID` |
| Final execution | final integration | orchestrator | all gates closed | Execute cases 0-5 in order and run `npm run verify:final-smoke-evidence` |

Merge/order of operations:
1. Runtime provisioning closes Vault, DB, and scaled dependency gates.
2. Notifications lane lands/deploys identity and channel policy.
3. Orchestrator runs `npm run verify:final-smoke-prereqs` and closes its gates.
4. Orchestrator approves invoices deployment and consumer enable.
5. Orchestrator creates the synthetic fixture and runs the final smoke.
6. Validation owner runs `ORDER_ID=<ORDER_ID> PAYMENT_APPLICATION_ID=<PAYMENT_APPLICATION_ID> npm run verify:final-smoke-evidence` and captures API, DB, Payments, and optional account/logging evidence without secrets or raw customer data.

## Open Blockers

- `[MISSING: ORDERS_EVENTS_CONSUMER_ENABLED=true for RabbitMQ final smoke]`
- `[MISSING: owner-approved invoices deploy and ORDERS_EVENTS_CONSUMER_ENABLED=true runtime switch]`
- `[MISSING: seller legal secret values for successful issuance]`
- `[MISSING: runtime MinIO/S3 invoice document storage provisioning and implementation for off-database immutable tax documents]`
- `[MISSING: approved synthetic fixture order/customer/payment data]`
- `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`
- `[MISSING: proof every active checkout/payment path uses central Orders UUIDs]`
