# Invoices Implementation State

```yaml
id: INVOICES-IMPLEMENTATION-STATE
status: active
owner: Invoices owner
created: 2026-07-02
last_updated: 2026-07-02
completeness_level: source-ready-runtime-gated
current_goal: Goal 1 Invoices Issuance MVP
current_chunk: Final-smoke prerequisite verification and runtime provisioning
blockers:
  - [MISSING: seller legal identity and VAT configuration before legal issuance]
  - [MISSING: deployed invoices workload, INVOICES_PUBLIC_BASE_URL, and ORDERS_EVENTS_CONSUMER_ENABLED=true for final smoke]
  - [MISSING: final-smoke prerequisite verifier passing in live runtime]
  - [MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]
  - [MISSING: runtime MinIO/S3 invoice document storage provisioning and implementation for off-database immutable tax documents]
```

## Current Checkpoint

2026-07-02: Initial implementation creates the invoices bounded context,
event-driven trigger contract, database model, annual invoice sequences, HTML
document rendering, opaque download-token access, and optional client stubs for
Orders, Payments, Notifications, and Logging. The service is source-ready but
not production-ready until seller legal configuration, invoices deployment,
Orders service-role access, final-smoke evidence, and runtime storage provisioning are
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
Auth subject/id when the stored Orders snapshot carries one, with normalized
`orderSnapshot.customer.email` retained as a legacy fallback. Responses omit
raw snapshots, document HTML, token hashes, customer addresses, and internal
event fields. Producer proof that new Orders snapshots always carry a stable
Auth subject is still `[MISSING]`.

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

2026-07-02 continuation: Added source-level PDF document generation with
PDFKit. Each issued proforma/final invoice now stores rendered PDF bytes,
SHA-256 checksum, MIME type, and filename alongside the existing immutable
HTML snapshot. Internal and tokenized public `.pdf` endpoints are available,
download-link responses include both HTML and PDF URLs, and Notifications now
prefers the PDF URL while preserving the existing HTML URL contract. External
object storage and provider attachment policy remain future runtime gates.

2026-07-02 continuation: Selected the off-database invoice document storage
contract. `docs/orchestrator/INVOICE_DOCUMENT_STORAGE_CONTRACT.md` defines a
future MinIO/S3-backed immutable PDF object path owned by invoices, with a
private bucket, deterministic key layout, SHA-256 object metadata, tokenized or
presigned access, retention/immutability rules, sanitized Logging boundaries,
and explicit deferral of direct Notifications attachments. Current runtime
remains DB-backed PDF storage until the MinIO/S3 bucket, service credentials,
retention policy, DB object-reference migration, upload/presign client, and
backfill/rollback plan are approved and implemented. Validation passed:
`npm run verify:contracts`, `npm run verify:runtime-readiness`, `npm test`,
and `git diff --check`.

2026-07-02 continuation: Live core runtime prerequisites now pass without
printing secret values. `npm run verify:runtime-prereqs` confirms
`secret/prod/invoices-microservice` exists with required key names, the
`invoices` database exists, and Orders, Payments, Notifications, Logging, and
RabbitMQ are ready `1/1`. `npm run verify:final-smoke-prereqs` still fails
closed on missing invoices deployment, missing `INVOICES_PUBLIC_BASE_URL`,
`ORDERS_EVENTS_CONSUMER_ENABLED=true` not enabled, missing seller legal secret,
and the not-yet-run final smoke gate. Payments key registration, Notifications
token projection, Notifications `invoices.documents` channel policy, and
Notifications no-send validation are verified present.

2026-07-02 continuation: Fixed a false-negative in
`scripts/check-final-smoke-prereqs.sh` where the Notifications channel policy
SQL was fragile inside nested shell quoting. The verifier now pipes SQL into
`psql` through `kubectl exec -i` and keeps the service/purpose/channel values
as quoted psql variables. Live recheck confirms
`Notifications invoices.documents channel policy allows
invoices-microservice/transactional`; final smoke remains blocked only by
missing invoices deployment/config/consumer switch and seller legal secret.

2026-07-02 continuation: First deploy attempt built and pushed image
`localhost:5000/invoices-microservice:2d3a7d6`, created the ConfigMap,
ExternalSecret, Deployment, Service, Ingress, and TLS certificate, but rollout
failed because the Docker image started `node dist/main.js` while the Nest build
emits `dist/src/main.js`. The Dockerfile was corrected and
`verify-runtime-readiness` now asserts the container entrypoint matches the
build output.

2026-07-02 continuation: Added `npm run verify:final-smoke-prereqs` for the
post-deploy/pre-smoke gate. It checks the deployed invoices workload, final
consumer enablement, seller legal secret, Payments `payments:read` scope for
the invoices API key, Notifications token projection, `invoices.documents`
channel policy, and the Notifications no-send validation script without
printing secret values.

2026-07-02 continuation: Added subject-aware customer account matching in
`invoices-microservice`. Auth validation now preserves `sub`/`id`; account
listing and customer download-link rotation match stored order snapshots by
customer Auth subject fields first and keep email fallback for legacy rows.
This closes the invoices-side source gap, but final smoke remains gated on
`[MISSING: runtime proof that deployed Orders includes c4f1332 and
authenticated channel create callers pass Auth subject into new order
snapshots]`. Validation passed: focused account tests,
`npm run build`, full `npm test`, `npm run verify:contracts`,
`npm run verify:runtime-readiness`, and `git diff --check`.

2026-07-02 continuation: Strengthened the source-level Logging contract.
`LoggerService` now redacts bearer tokens, token/secret/password/cookie/API-key
assignments, email addresses, and sensitive metadata keys before sending
`POST /api/logs` payloads to `logging-microservice`. Remote logging remains
fail-open so invoice issuance is not blocked by transient observability
outages. Validation passed: focused logger tests, `npm run build`, full
`npm test`, `npm run verify:contracts`, `npm run verify:runtime-readiness`,
and `git diff --check`.

2026-07-02 continuation: Cross-repo source proof for Auth subject snapshots is
now available in `orders-microservice` commit `c4f1332 feat: persist auth
subject in order snapshots`. Orders accepts and persists normalized
`customer.authUserId`/`customer.subject` while keeping RabbitMQ events
trigger-only. Invoices already matches those fields for account access.
Remaining blocker is runtime proof that the deployed Orders workload includes
that commit and authenticated channel create callers send the Auth subject.

## Preserved Intent

Orders remains canonical order truth and event producer. Payments remains
payment identity/reconciliation truth. Invoices owns issuance records, invoice
numbering, immutable invoice snapshots, document rendering, and delivery
attempt state.
