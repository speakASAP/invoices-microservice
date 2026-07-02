# Invoices Implementation State

```yaml
id: INVOICES-IMPLEMENTATION-STATE
status: active
owner: Invoices owner
created: 2026-07-02
last_updated: 2026-07-02
completeness_level: source-scaffold
current_goal: Goal 1 Invoices Issuance MVP
current_chunk: Initial service scaffold and contract plan
blockers:
  - [MISSING: production DB secret and database provisioning for invoices]
  - [MISSING: runtime projection and verification of ORDERS_SERVICE_TOKEN for invoices-microservice reads]
  - [MISSING: seller legal identity and VAT configuration]
  - [MISSING: Notifications service token/channel policy for invoice delivery through channelKey invoices.documents]
  - [MISSING: PDF attachment/storage contract]
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

## Preserved Intent

Orders remains canonical order truth and event producer. Payments remains
payment identity/reconciliation truth. Invoices owns issuance records, invoice
numbering, immutable invoice snapshots, document rendering, and delivery
attempt state.
