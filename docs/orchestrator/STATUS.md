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
- `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`
- `[MISSING: proof that all active checkout/payment paths pass central Orders UUIDs to Payments]`

## 2026-07-02 - Account Invoice Access Source Lane

Added source-level customer account access inside `invoices-microservice`:

- `GET /invoices/account` validates the bearer token through Auth
  `POST /auth/validate` and lists only invoices whose stored Orders snapshot
  matches the normalized Auth subject/id or legacy customer email.
- `POST /invoices/account/:invoiceId/download-link` validates the same Auth
  customer scope and rotates an opaque public document token without exposing
  `downloadTokenHash`.
- Account responses are intentionally smaller than internal invoice responses:
  no raw order snapshot, payment snapshot, source event ids, token hashes,
  document HTML, customer address, or blocked internals are returned.

The lane remains source-only until runtime blockers close. It scopes by email
because `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`
is still open.

Validation:

- `npm test -- --runTestsByPath test/account-invoices.spec.ts`: passed, 6 tests.
- `npm run build`: passed.
- `npm test`: passed, 4 suites / 12 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.

## 2026-07-02 - Runtime Preflight Scaled-Zero Guard

Tightened `npm run verify:runtime-prereqs` so required Deployments and
StatefulSets must have desired replicas greater than zero before they can be
reported ready. This prevents a dependency scaled to `0/0` from being treated
as a usable Orders/Payments/Notifications smoke-test dependency.

Current live preflight evidence:

- `[MISSING: Vault path secret/prod/invoices-microservice]`
- `[MISSING: database invoices]`
- `[MISSING: deployment orders-microservice desired replicas > 0]`
- `[MISSING: deployment payments-microservice desired replicas > 0]`
- `[MISSING: deployment notifications-microservice desired replicas > 0]`
- Logging and RabbitMQ are ready.

Validation:

- `npm run verify:runtime-prereqs`: failed as expected with explicit
  scaled-zero blockers and no secret values printed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.

## 2026-07-02 - Optional Seller Legal Runtime Secret

Split startup/runtime prerequisites from issuance/legal prerequisites:

- `invoices-microservice-secret` now contains only deploy-critical runtime
  keys: DB password, internal service token, Orders token, Payments API key,
  and Notifications token.
- `invoices-microservice-seller-secret` is projected as optional. If seller
  legal fields are missing, invoice issuance still fails closed with
  `seller_legal_config_missing`, but the service can start once core runtime
  prerequisites are ready.
- `k8s/seller-secret.yaml.example` documents the seller legal keys without
  inventing production values.

Validation:

- `npm run verify:runtime-readiness`: passed.
- server-side Kubernetes dry-run for ConfigMap, ExternalSecret, Deployment,
  Service, and Ingress: passed.

## 2026-07-02 - Integration Orchestration Refresh

Current source state:

- `invoices-microservice` is clean on `main` at
  `f3e518f feat: make seller legal config optional for startup`.
- `orders-microservice` source accepts `x-service-name:
  invoices-microservice` with `INVOICES_INTERNAL_SERVICE_TOKEN`/
  `INVOICES_ORDERS_SERVICE_TOKEN` for the internal order read boundary.
- `payments-microservice` source exposes
  `GET /payments/status/by-order-id?applicationId=<applicationId>&orderId=<orderId>`
  behind `X-API-Key` with `payments:read` scope.
- `notifications-microservice` source commit
  `8a6b7ed feat: allow invoices notifications service actor` accepts
  `INVOICES_NOTIFICATIONS_SERVICE_TOKEN` as an `invoices-microservice`
  machine actor. That repository is currently `main...origin/main [ahead 1]`.

Live deploy preflight remains blocked and correctly fails closed:

- `npm run verify:runtime-prereqs`: failed without printing secret values.
- `[MISSING: Vault path secret/prod/invoices-microservice]`
- `[MISSING: database invoices]`
- `[MISSING: deployment orders-microservice desired replicas > 0]`
- `[MISSING: deployment payments-microservice desired replicas > 0]`
- `[MISSING: deployment notifications-microservice desired replicas > 0]`
- Logging is ready `1/1`.
- RabbitMQ is ready `1/1`.

Parallel lanes now active:

- Runtime provisioning lane owns Vault path/key names, invoices database
  provisioning plan, and dependency replica readiness.
- Notifications delivery contract lane owns `invoices.documents` channel
  policy readiness and no-send validation.
- Final smoke lane owns the dependency-gated smoke plan for order creation,
  proforma issuance, payment completion, final tax invoice issuance, account
  access, and logging evidence.

Next action: integrate lane outputs, then rerun `npm run verify:runtime-prereqs`
before any deploy attempt.

## 2026-07-02 - Lane Integration And Runtime Prereq Recheck

Integrated the parallel lane outputs into the durable orchestration state:

- Notifications delivery contract lane completed remote commit
  `676b662 test: define invoices notification readiness contract` on top of
  `8a6b7ed feat: allow invoices notifications service actor`.
- Final smoke lane added
  `docs/orchestrator/FINAL_RUNTIME_SMOKE_PLAN.md` as a dependency-gated,
  non-mutating runbook.
- Current live runtime prerequisite check fails closed only on:
  - `[MISSING: Vault path secret/prod/invoices-microservice]`
  - `[MISSING: database invoices]`
- Orders, Payments, Notifications, Logging, and RabbitMQ are all ready `1/1`.

Validation:

- `npm run verify:runtime-prereqs`: failed as expected with only the two
  runtime provisioning blockers above and no secret values printed.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- Notifications lane validation passed: readiness-script syntax, focused Jest,
  `npm run build`, full Jest, and `git diff --check`.

Next action: provision the invoices Vault path and `invoices` database, then
rerun `npm run verify:runtime-prereqs` before deployment or final smoke.

## 2026-07-02 - PDF Document Baseline

Added source-level PDF support for invoice documents:

- `pdfkit` renders a PDF from the same immutable order/seller snapshot used for
  HTML invoice rendering.
- `invoice_documents` now stores `documentPdf`, `documentPdfSha256`,
  `documentMimeType`, and `documentFilename`.
- Internal and tokenized public PDF endpoints are available at
  `/invoices/:invoiceId/document.pdf` and `/documents/:invoiceId.pdf`.
- Download-link rotation returns both HTML and PDF URLs; Notifications prefers
  the PDF URL while preserving the existing HTML URL.

Validation:

- `npm test -- --runTestsByPath test/invoices.service.spec.ts`: passed, 1 suite / 1 test.
- `npm test -- --runTestsByPath test/invoice-pdf.service.spec.ts test/account-invoices.spec.ts test/invoice-template.service.spec.ts`: passed, 3 suites / 8 tests.
- `npm run build`: passed.
- `npm test`: passed, 6 suites / 14 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.

Remaining blocker: external object storage or direct attachment policy is still
`[MISSING]`; the source baseline stores PDFs in the invoices database.

## 2026-07-02 - Final Smoke Prerequisite Verifier

Added `npm run verify:final-smoke-prereqs` as a non-mutating final integration
gate. It intentionally stays out of `scripts/deploy.sh`: first deployment can
remain blocked only by core runtime prerequisites, while final smoke must also
prove:

- `invoices-microservice` is deployed and ready;
- `ORDERS_EVENTS_CONSUMER_ENABLED=true` and public base URL are set;
- seller legal secret values are configured;
- the invoices Payments API key is registered in Payments with `payments:read`;
- Notifications projects the invoices token, has an active
  `invoices.documents` channel policy for `invoices-microservice` and
  `transactional`, and its no-send validation script passes.

The verifier reads secrets only for equality/scope checks and never prints
secret values.


## 2026-07-02 - Final Smoke Prerequisite Live Check

Ran the new final-smoke prerequisite verifier against live Alfares state. It
failed closed without printing secret values.

Live blockers reported by `npm run verify:final-smoke-prereqs`:

- `[MISSING: Vault path secret/prod/invoices-microservice]`
- `[MISSING: database invoices]`
- `[MISSING: core runtime prerequisites pass before final smoke]`
- `[MISSING: deployment invoices-microservice exists in namespace statex-apps]`
- `[MISSING: INVOICES_PUBLIC_BASE_URL configured with https]`
- `[MISSING: ORDERS_EVENTS_CONSUMER_ENABLED=true for RabbitMQ final smoke]`
- `[MISSING: seller legal secret invoices-microservice-seller-secret]`
- `[MISSING: Vault key secret/prod/invoices-microservice.PAYMENTS_API_KEY]`
- `[MISSING: Vault key secret/prod/invoices-microservice.NOTIFICATIONS_SERVICE_TOKEN]`
- `[MISSING: Notifications channel_registry policy for invoices.documents allows invoices-microservice/transactional]`
- `[MISSING: Notifications no-send invoices.documents validation passes]`

The dependency workloads remain ready in `verify:runtime-prereqs`, but final
smoke must not start until the stricter verifier passes.

## 2026-07-02 - Subject-Aware Account Matching

Closed the invoices-side source gap for stable Auth identity matching without
touching the currently dirty Orders/Auth repositories:

- `CustomerAuthGuard` preserves Auth `sub`/`id` as a normalized account
  subject after `POST /auth/validate`.
- `GET /invoices/account` and
  `POST /invoices/account/:invoiceId/download-link` now scope by stored Orders
  snapshot subject fields first:
  `customer.id`, `customer.userId`, `customer.authUserId`, `customer.subject`,
  `customer.sub`, `customerId`, `customerUserId`, `authUserId`, and `userId`.
- Legacy snapshots still match by normalized `customer.email`.
- `toStoredOrderSnapshot` preserves top-level customer identity fields if
  Orders starts returning them in the internal snapshot.

Remaining blocker:

- `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`

Validation:

- `npm test -- --runTestsByPath test/account-invoices.spec.ts`: passed, 8 tests.
- `npm run build`: passed.
- `npm test`: passed, 6 suites / 16 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.


## 2026-07-02 - Logging Contract Hardening

Added test-covered source evidence for the Logging integration:

- invoices logs are posted as `service=invoices-microservice` to
  `POST /api/logs`;
- bearer tokens, email addresses, token/secret/password/cookie/API-key
  assignments, and sensitive metadata keys are redacted before emission;
- remote logging failures are swallowed so invoice issuance stays fail-open.

Validation:

- `npm test -- --runTestsByPath test/logger.service.spec.ts`: passed, 3 tests.
- `npm run build`: passed.
- `npm test`: passed, 7 suites / 19 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.


## 2026-07-02 - Runtime Activation Plan Refresh

Added `docs/orchestrator/RUNTIME_ACTIVATION_PLAN.md` as the owner-ready,
non-mutating activation plan for the source-ready invoices service. It splits
runtime work into approval-gated Vault, database, Payments key, Notifications
delivery, seller legal, deploy switch, and final smoke lanes with explicit
forbidden actions and validation commands.

Validation:

- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.


## 2026-07-02 - Orders Auth Subject Source Proof Integrated

Integrated read-only sub-agent findings and Orders source follow-up:

- Orders source now has commit `c4f1332 feat: persist auth subject in order
  snapshots`.
- `orders.create.v1` accepts a stable Auth subject and persists normalized
  `customer.authUserId`/`customer.subject`.
- Orders event contracts remain trigger-only; no customer identity was added to
  RabbitMQ lifecycle events.
- Invoices account access already matches `customer.authUserId` and
  `customer.subject` in stored order snapshots.

Remaining blocker:

- `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`

Validation:

- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.
