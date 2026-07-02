# Invoices Orchestrator Status

## 2026-07-02 - Initial Service Scaffold

Created the source plan for a standalone invoices service. Key decisions:

- proforma trigger: `orders.order.created.v1`;
- final invoice trigger: `orders.order.paid.v1`;
- Orders events remain trigger-only and must not gain customer/billing fields;
- service fetches full Orders snapshot through an internal read role;
- missing legal/runtime data creates blocked invoice records instead of fake
  invoices;
- deployment is blocked until DB, secrets, seller legal config, Orders role, and
  delivery/storage contracts are resolved.

Validation:

- `npm run build`: passed.
- `npm test`: passed, 2 suites / 4 tests.
- `npm run verify:contracts`: passed.
- `git diff --check`: passed.
- `kubectl apply --dry-run=client -f k8s/configmap.yaml -f k8s/external-secret.yaml -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/ingress.yaml -n statex-apps`: passed.
- Server-side dry-run passed for ConfigMap, Deployment, Service, and Ingress,
  but ExternalSecret admission was blocked by platform state:
  `[MISSING: external-secrets-webhook endpoints available for server-side validation]`.

Next action: provision DB/Vault/runtime configuration and resolve Orders token
projection before enabling the RabbitMQ consumer or deploying.

## 2026-07-02 - Runtime Readiness Hardening

Added an explicit database bootstrap gate. `DB_AUTO_CREATE=true` can create the
configured database through the admin database only when that runtime flag is
set; production manifests keep `DB_AUTO_CREATE=false` by default. Database names
are restricted to letters, numbers, and underscores before any create statement
can be built.

Added `npm run verify:runtime-readiness` to assert:

- DB auto-create remains opt-in;
- production config keeps DB auto-create disabled by default;
- the RabbitMQ Orders consumer remains disabled until runtime blockers close;
- the ExternalSecret uses the live `external-secrets.io/v1` API;
- the deployment projects the invoices runtime secret.

Validation:

- `npm run build`: passed.
- `npm test`: passed, 3 suites / 6 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.
- Server-side Kubernetes dry-run still passes for ConfigMap, Deployment,
  Service, and Ingress, but ExternalSecret admission remains blocked because
  `external-secrets-webhook` has no endpoints while the cluster is still
  recreating core pods after a k3s/node restart.

## 2026-07-02 - Internal Document Access And Link Rotation

Added internal guarded document access for delivery/account integrations:

- `GET /invoices/:invoiceId/document.html` returns rendered HTML only to
  internal callers with `INVOICES_INTERNAL_SERVICE_TOKEN`;
- `POST /invoices/:invoiceId/download-link` rotates the opaque public download
  token and returns a fresh public URL for retry delivery or account download
  surfaces.

The existing public `GET /documents/:invoiceId.html?token=...` remains token
guarded. This keeps customer-facing links opaque while allowing Notifications
or a future account surface to recover after a failed initial send without
reading raw database token hashes.

Validation:

- `npm run build`: passed.
- `npm test`: passed, 3 suites / 6 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.

## 2026-07-02 - Manifest Admission Recheck

Rechecked platform state after the k3s/node restart settled further.
`kubectl apply --dry-run=server -f k8s/configmap.yaml -f
k8s/external-secret.yaml -f k8s/deployment.yaml -f k8s/service.yaml -f
k8s/ingress.yaml -n statex-apps` now passes for all invoices manifests,
including the ExternalSecret.

Deployment remains blocked because runtime prerequisites are still not closed:

- `[MISSING: invoices database exists or owner-approved DB_AUTO_CREATE=true first deploy]`
- `[MISSING: secret/prod/invoices-microservice values for DB password, internal token, Orders token, Payments API key, Notifications token, and seller legal fields]`
- `[MISSING: core dependencies ready for deploy smoke: Orders, Payments, Notifications, Logging, RabbitMQ]`

## 2026-07-02 - Non-Secret Runtime Preflight

Added `npm run verify:runtime-prereqs` for the live Alfares deploy gate. The
script checks the Vault path and required key names without printing secret
values, checks whether the `invoices` database exists through the running
Postgres pod env, and verifies core workload readiness for Orders, Payments,
Notifications, Logging, and RabbitMQ. `scripts/deploy.sh` runs this gate before
Docker build/push and Kubernetes apply.

Source validation:

- `npm run build`: passed.
- `npm test`: passed, 3 suites / 6 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `kubectl apply --dry-run=server -f k8s/configmap.yaml -f k8s/external-secret.yaml -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/ingress.yaml -n statex-apps`: passed.

Live deploy preflight:

- `npm run verify:runtime-prereqs`: failed as expected with explicit runtime
  blockers and no secret values printed.
- `./scripts/deploy.sh`: failed at `verify:runtime-prereqs` before Docker
  build/push or Kubernetes apply.
- `[MISSING: Vault path secret/prod/invoices-microservice]`
- `[MISSING: database invoices]`
- `[MISSING: deployment orders-microservice ready 0/1]`
- `[MISSING: deployment payments-microservice ready 0/1]`
- `[MISSING: deployment notifications-microservice ready 0/1]`
- `[MISSING: deployment logging-microservice ready 0/1]`
- RabbitMQ was ready `1/1`.

## 2026-07-02 - Parallel Contract And Delivery Sweep

Read-only sub-agent sweeps produced these current contracts:

- Orders source produces `orders.order.created.v1` on order creation.
- Payments reports completed payment status to Orders; Orders emits
  `orders.order.paid.v1` only when the previous status was not already paid.
- Orders events remain trigger-only. Invoices must fetch full order snapshots
  through `GET /api/orders/:id` using the invoices service identity.
- Notifications is the current delivery transport through
  `POST /notifications/send` with `service=invoices-microservice`,
  `purpose=transactional`, and `channelKey=invoices.documents`.
- Invoices already has internal document read and download-link rotation.
- Customer account invoice listing/download is now source-implemented and stays
  separate from Notifications/runtime provisioning work until deploy.

Additional blockers:

- `[MISSING: Notifications channel_registry policy for invoices.documents allowing service invoices-microservice and purpose transactional]`
- `[MISSING: confirmation that NOTIFICATIONS_SERVICE_TOKEN is accepted by Notifications auth guard, or a dedicated invoices service actor/token path]`
- `[MISSING: Auth customer subject-to-order identity contract for non-email order matching]`
- `[MISSING: proof that all active checkout/payment paths pass central Orders UUIDs to Payments]`

## 2026-07-02 - Account Invoice Access Source Lane

Added source-level customer account access inside `invoices-microservice`:

- `GET /invoices/account` validates the bearer token through Auth
  `POST /auth/validate` and lists only invoices whose stored Orders snapshot
  has `customer.email` matching the normalized Auth email.
- `POST /invoices/account/:invoiceId/download-link` validates the same Auth
  customer scope and rotates an opaque public document token without exposing
  `downloadTokenHash`.
- Account responses are intentionally smaller than internal invoice responses:
  no raw order snapshot, payment snapshot, source event ids, token hashes,
  document HTML, customer address, or blocked internals are returned.

The lane remains source-only until runtime blockers close. It scopes by email
because `[MISSING: Auth customer subject-to-order identity contract for non-email order matching]`
is still open.

Validation:

- `npm test -- --runTestsByPath test/account-invoices.spec.ts`: passed, 6 tests.
- `npm run build`: passed.
- `npm test`: passed, 4 suites / 12 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
