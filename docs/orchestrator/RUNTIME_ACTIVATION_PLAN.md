# Runtime Activation Plan: Invoices Microservice

Status: approval-gated.
Owner lane: platform/runtime integration.
Repository: `/home/ssf/Documents/Github/invoices-microservice`.
Prepared: 2026-07-02.

This plan is intentionally non-mutating. It defines the exact work needed to
move the source-ready invoices service into deployed runtime without printing
or inventing secret values. Do not create databases, write Vault values, change
Payments keys, enable RabbitMQ consumption, or send notifications from this
lane until the owner approves the specific runtime action.

## Intent Preservation Chain

- Vision: every eligible order has one proforma invoice on order creation and
  one final tax invoice on payment completion.
- Goal Impact: close runtime prerequisites without moving order, payment,
  notification, logging, auth, or seller-legal ownership into Invoices.
- System: Invoices consumes Orders triggers, fetches Orders/Payments snapshots,
  renders immutable documents, delivers links through Notifications, and emits
  sanitized logs to Logging.
- Feature: runtime activation gate for DB, Vault, service identity, delivery,
  seller legal data, deploy switch, and final smoke.
- Task: provide owner-ready workstreams, allowed/forbidden actions, validation
  commands, blockers, and merge/deploy order.
- Execution Plan: keep source checks green, close runtime gates in parallel,
  deploy only after `verify:runtime-prereqs`, then run final smoke only after
  `verify:final-smoke-prereqs`.
- Coding Prompt: source-only edits are allowed here; live runtime mutation is
  approval-gated.
- Code: this runbook plus existing verifier scripts.
- Validation: commands listed under each lane.

## Current Gate State

Last observed on 2026-07-02:

- `npm run verify:runtime-prereqs`: passes. Vault key presence checks,
  `invoices` database existence, and Orders, Payments, Notifications, Logging,
  and RabbitMQ readiness are all verified without printing secret values.
- Orders, Payments, Notifications, Logging, and RabbitMQ all report ready
  `1/1`.
- `npm run verify:final-smoke-prereqs`: fails closed because final-smoke-only
  legal/consumer gates are not configured yet:
  `[MISSING: ORDERS_EVENTS_CONSUMER_ENABLED=true for RabbitMQ final smoke]`,
  and `[MISSING: seller legal secret invoices-microservice-seller-secret]`.
- Invoices deployment, public base URL, Payments API key scope, Notifications
  token projection, Notifications `invoices.documents` channel policy, and
  Notifications no-send validation are verified present.

## Parallel Runtime Workstreams

| Lane | Status | Owner | Scope | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- |
| A Vault core | complete | platform/secrets owner | `secret/prod/invoices-microservice` keys exist: `DB_PASSWORD`, `INVOICES_INTERNAL_SERVICE_TOKEN`, `ORDERS_SERVICE_TOKEN`, `PAYMENTS_API_KEY`, `NOTIFICATIONS_SERVICE_TOKEN` | printing secret values; placeholder values | `npm run verify:runtime-prereqs` passes key-presence checks |
| B Database | complete | DB/platform owner | `invoices` database exists | implicit DB create; destructive DB operations | `npm run verify:runtime-prereqs` database check passes |
| C Payments key | complete | Payments owner | invoices `PAYMENTS_API_KEY` is registered in Payments `API_KEYS` with `payments:read` scope | sharing raw keys in docs/logs | `npm run verify:final-smoke-prereqs` scope check passes |
| D Notifications delivery | complete-for-no-send | Notifications owner | `INVOICES_NOTIFICATIONS_SERVICE_TOKEN` is projected; active `invoices.documents` policy allows `invoices-microservice` and `transactional` | real customer sends before approval | `npm run verify:final-smoke-prereqs`; Notifications no-send readiness pass |
| E Seller legal | approval-gated | legal/platform owner | create `secret/prod/invoices-microservice-seller` with seller legal identity and tax/company identifier, then sync `invoices-microservice-seller-secret` through ExternalSecret | fake legal identity; printing legal secret values | `npm run verify:seller-legal-source`; `npm run runtime:sync-seller-legal`; `npm run verify:consumer-enable-prereqs` |
| F Deploy switch | partially-complete | integration owner | workload deployed with `INVOICES_PUBLIC_BASE_URL=https://invoices.alfares.cz`; enable `ORDERS_EVENTS_CONSUMER_ENABLED=true` only for final smoke after seller legal data exists | enabling consumer before seller legal data exists | `npm run verify:consumer-enable-prereqs`; `npm run runtime:enable-orders-consumer`; `npm run verify:final-smoke-prereqs` |
| G Final smoke | dependency-gated | validation owner | synthetic order, proforma invoice, paid event, final tax invoice, account download, logging evidence | real customer order/payment/notification; unapproved token rotation | `docs/orchestrator/FINAL_RUNTIME_SMOKE_PLAN.md`; `ORDER_ID=<ORDER_ID> PAYMENT_APPLICATION_ID=<PAYMENT_APPLICATION_ID> npm run verify:final-smoke-evidence` |
| H Document storage | source-schema-ready-runtime-gated | invoices/storage + MinIO owners | future private MinIO/S3 bucket, nullable object references, checksum verified upload/read, tokenized or presigned access | public bucket, root credentials, object overwrite/delete, raw PDF logs | `docs/orchestrator/INVOICE_DOCUMENT_STORAGE_CONTRACT.md`; future storage smoke |

## Activation Order

1. Keep source clean and green:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run build && npm test && npm run verify:contracts && npm run verify:runtime-readiness && git diff --check'
   ```

2. Close lanes A and B, then prove core deploy prerequisites:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:runtime-prereqs'
   ```

3. Deploy only after step 2 passes:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && ./scripts/deploy.sh'
   ```

4. Close lanes C, D, E, and F, then prove final smoke prerequisites:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:final-smoke-prereqs'
   ```

   Before enabling the Orders consumer, prove every other final-smoke gate:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:seller-legal-source'
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run runtime:sync-seller-legal'
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:consumer-enable-prereqs'
   ```

   After seller legal data exists and the pre-enable gate passes, enable the
   consumer through the guarded runtime script:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run runtime:enable-orders-consumer'
   ```

5. Execute final smoke with synthetic owner-approved fixture only after step 4
   passes. Capture evidence with the read-only verifier first:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && ORDER_ID="<ORDER_ID>" PAYMENT_APPLICATION_ID="<PAYMENT_APPLICATION_ID>" npm run verify:final-smoke-evidence'
   ```

   Set `CUSTOMER_BEARER_TOKEN` or `LOGGING_ADMIN_BEARER_TOKEN` only when those
   approved synthetic credentials are available. Set
   `VERIFY_DOWNLOAD_LINK_ROTATION=true FINAL_SMOKE_APPROVED=true` only when
   durable token-state mutation is approved for the final smoke.

6. Record final evidence in `docs/orchestrator/STATUS.md` and
   `docs/IMPLEMENTATION_STATE.md`.

## Approval Boundaries

- Owner approval required: create `invoices` database, set Vault values, change
  Payments runtime API keys, write seller legal secrets, deploy the service, set
  `ORDERS_EVENTS_CONSUMER_ENABLED=true`, create fixture orders/payments, or send
  notifications.
- No approval required: read-only verifiers, source-only docs/tests/scripts,
  Kubernetes dry-runs, and non-secret status checks.

## Remaining Blockers

- `[MISSING: ORDERS_EVENTS_CONSUMER_ENABLED=true for RabbitMQ final smoke]`
- `[MISSING: seller legal secret values for successful issuance]`
- `[MISSING: owner-approved invoices deploy and ORDERS_EVENTS_CONSUMER_ENABLED=true runtime switch]`
- `[MISSING: approved synthetic fixture order/customer/payment data]`
- `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`
- `[MISSING: runtime MinIO/S3 invoice document bucket, credentials, retention, upload/presign client, migration application, backfill, and checksum smoke]`
