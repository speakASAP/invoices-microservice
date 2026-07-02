# Invoices Implementation State

```yaml
id: INVOICES-IMPLEMENTATION-STATE
status: active
owner: Invoices owner
created: 2026-07-02
last_updated: 2026-07-02
completeness_level: source-ready-runtime-gated
current_goal: Goal 1 Invoices Issuance MVP
current_chunk: Runtime provisioning, notification contract, and final smoke gating
blockers:
  - [MISSING: Vault path secret/prod/invoices-microservice with core runtime key names]
  - [MISSING: invoices database provisioning or owner-approved DB_AUTO_CREATE=true first deploy]
  - [MISSING: Payments API key value registered in Payments API_KEYS with payments:read scope]
  - [MISSING: Notifications channel_registry policy for invoices.documents allowing service invoices-microservice and purpose transactional]
  - [MISSING: seller legal identity and VAT configuration before legal issuance]
  - [MISSING: PDF attachment/storage contract for immutable tax documents]
```

## Current Checkpoint

2026-07-02: Initial implementation creates the invoices bounded context,
event-driven trigger contract, database model, annual invoice sequences, HTML
document rendering, opaque download-token access, and optional client stubs for
Orders, Payments, Notifications, and Logging. The service is source-ready but
not production-ready until runtime secrets, DB provisioning, seller legal
configuration, Orders service-role access, and delivery/storage policy are
resolved.

Validation passed on 2026-07-02: `npm run build`, `npm test`, `npm run
verify:contracts`, `git diff --check`, and client-side Kubernetes dry-run for
all manifests. Server-side dry-run passed for ConfigMap, Deployment, Service,
and Ingress; ExternalSecret server validation is blocked by
`[MISSING: external-secrets-webhook endpoints available for server-side validation]`.

2026-07-02 continuation: Added runtime readiness hardening for first deploy.
The database bootstrap path is now explicit and opt-in through
`DB_AUTO_CREATE=true`; production config keeps it disabled by default until the
database is either pre-provisioned or owner-approved for first deploy creation.
`npm run verify:runtime-readiness` validates DB bootstrap gating, consumer
fail-closed config, ExternalSecret API version, and secret projection.
Validation passed: `npm run build`, `npm test`, `npm run verify:contracts`,
`npm run verify:runtime-readiness`, and `git diff --check`. Server-side
Kubernetes dry-run still has the platform blocker
`[MISSING: external-secrets-webhook endpoints available for server-side validation]`.

2026-07-02 continuation: Added internal guarded document retrieval and
download-link rotation so delivery/account integrations can recover a document
link after initial notification delivery is disabled or failed. Public customer
access remains protected by opaque token hash verification.
Validation passed: `npm run build`, `npm test`, `npm run verify:contracts`,
`npm run verify:runtime-readiness`, and `git diff --check`.

2026-07-02 continuation: Manifest admission recheck now passes with
server-side dry-run for ConfigMap, ExternalSecret, Deployment, Service, and
Ingress. Deployment remains blocked by missing runtime provisioning and core
dependency readiness: invoices database/DB auto-create decision, Vault values
under `secret/prod/invoices-microservice`, and ready Orders/Payments/
Notifications/Logging/RabbitMQ pods for smoke validation.

2026-07-02 continuation: Added `npm run verify:runtime-prereqs` as the live
non-secret deploy preflight and wired it into `scripts/deploy.sh` before image
build/push and Kubernetes apply. It checks Vault path/key presence without
printing values, checks the `invoices` database through the Postgres pod env,
and checks core dependency readiness. Current live result remains blocked by
missing `secret/prod/invoices-microservice`, missing `invoices` database, and
not-ready Orders/Payments/Notifications/Logging pods. `./scripts/deploy.sh`
now stops at that gate before Docker or Kubernetes mutation.

2026-07-02 continuation: Parallel read-only sub-agent sweeps confirmed that
Orders source currently produces both invoice trigger events:
`orders.order.created.v1` on order creation and `orders.order.paid.v1` after
Payments reports completed status into Orders. Delivery should use
Notifications `POST /notifications/send` with `channelKey=invoices.documents`;
customer account invoice listing/download should be handled separately from
delivery/runtime provisioning work.

2026-07-02 continuation: Added source-level account invoice access in
`invoices-microservice`. `GET /invoices/account` and
`POST /invoices/account/:invoiceId/download-link` validate customer bearer
tokens through Auth `POST /auth/validate`, then scope by normalized
`orderSnapshot.customer.email`. Responses omit raw snapshots, document HTML,
token hashes, customer addresses, and internal event fields. This is an
email-scoped interim contract because stable Auth subject-to-order matching is
still `[MISSING]`.

2026-07-02 continuation: Tightened the live runtime preflight so required
Deployments and StatefulSets must have desired replicas greater than zero. That
historical run showed missing Vault path, missing `invoices` database, and
dependency replica blockers, while Logging and RabbitMQ were ready.

2026-07-02 continuation: Split runtime startup prerequisites from seller legal
issuance prerequisites. The core ExternalSecret no longer requires
`INVOICE_SELLER_*` values, and the Deployment reads
`invoices-microservice-seller-secret` as an optional secret. Missing seller
legal data still blocks invoice issuance through `seller_legal_config_missing`,
but it no longer blocks a fail-closed service deployment.

2026-07-02 continuation: Reconfirmed cross-service source contracts from live
remote repositories. Orders source accepts `x-service-name:
invoices-microservice` with `INVOICES_INTERNAL_SERVICE_TOKEN`/
`INVOICES_ORDERS_SERVICE_TOKEN` for the order read boundary. Payments source
exposes `GET /payments/status/by-order-id` behind `X-API-Key` with the
`payments:read` scope; the runtime value must exist in both invoices Vault
configuration and Payments `API_KEYS`/`PAYMENT_API_KEY_SCOPES`.
Notifications source readiness is now at
`676b662 test: define invoices notification readiness contract` on top of
`8a6b7ed feat: allow invoices notifications service actor`. The identity change
accepts `INVOICES_NOTIFICATIONS_SERVICE_TOKEN` as an `invoices-microservice`
machine actor and projects it from
`secret/prod/invoices-microservice#NOTIFICATIONS_SERVICE_TOKEN`; the readiness
contract defines the no-send `invoices.documents` validation path. Deployment
is still gated until that Vault key exists and `invoices.documents` channel
policy is configured.

2026-07-02 continuation: Fresh runtime-prereq recheck shows dependency
workloads are now ready. `npm run verify:runtime-prereqs` fails only on
`[MISSING: Vault path secret/prod/invoices-microservice]` and
`[MISSING: database invoices]`; Orders, Payments, Notifications, Logging, and
RabbitMQ all report ready `1/1`. Added
`docs/orchestrator/FINAL_RUNTIME_SMOKE_PLAN.md` as the dependency-gated final
smoke runbook for proforma issuance, final tax invoice issuance, account
access, and logging evidence.

## Preserved Intent

Orders remains canonical order truth and event producer. Payments remains
payment identity/reconciliation truth. Invoices owns issuance records, invoice
numbering, immutable invoice snapshots, document rendering, and delivery
attempt state.
