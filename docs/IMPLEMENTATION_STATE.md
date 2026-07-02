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
  - [MISSING: ORDERS_EVENTS_CONSUMER_ENABLED=true for final smoke]
  - [MISSING: final-smoke prerequisite verifier passing in live runtime]
  - [MISSING: FlipFlop runtime smoke proving authenticated central order snapshots carry customer.authSubject]
  - [MISSING: Cliplot hosted Auth callback/session contract before authenticated checkout can pass Auth subject]
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

2026-07-02 continuation: Added the source-level nullable object-reference
schema for future off-database invoice PDFs without adding S3 runtime
dependencies or changing current DB-backed document reads. `InvoiceDocument`
and the idempotent migration now include `documentObjectBucket`,
`documentObjectKey`, `documentObjectSha256`, `documentObjectEtag`,
`documentObjectSize`, and `documentStoredAt`, plus a partial object-key index.
The storage contract now marks this as source-implemented/runtime-not-applied.
Runtime bucket provisioning, service-scoped credentials, upload/head/get/presign
client, checksum readback, backfill, and deploy/migration application remain
gated.

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

2026-07-02 continuation: Redeployed `invoices-microservice` at commit
`22c93da` with image digest
`sha256:451bbb135a681bb91c7fe5425069c68099f6f4f9169fe5c908940deb26310577`.
Rollout passed, the pod is ready `1/1`, and public
`https://invoices.alfares.cz/health` returns `success=true`. A Notifications
runtime drift to image `f144e14` caused invoice no-send validation to return
401; redeploying `notifications-microservice` from integration commit
`f855764` restored `/notifications/validate`. Current
`npm run verify:final-smoke-prereqs` passes core runtime, invoices deployment,
public base URL, Payments key scope, Notifications token projection,
Notifications channel policy, and Notifications no-send validation. It still
fails closed on `[MISSING: ORDERS_EVENTS_CONSUMER_ENABLED=true for RabbitMQ
final smoke]` and `[MISSING: seller legal secret
invoices-microservice-seller-secret]`.

2026-07-02 continuation: Added guarded consumer-enable tooling for the final
smoke lane. `npm run verify:consumer-enable-prereqs` runs the final-smoke gate
with `ORDERS_EVENTS_CONSUMER_ENABLED=false` allowed, so seller legal and all
other gates can be proved before the RabbitMQ consumer is enabled.
`npm run runtime:enable-orders-consumer` refuses to patch runtime unless that
pre-enable gate passes, then patches
`ORDERS_EVENTS_CONSUMER_ENABLED=true`, rolls `invoices-microservice`, and
reruns the strict final-smoke prerequisite check. The script was not executed
because seller legal data is still `[MISSING]`.

2026-07-02 continuation: Added Vault-backed seller legal bootstrap tooling.
`k8s/seller-external-secret.yaml` maps the dedicated
`secret/prod/invoices-microservice-seller` Vault path into
`invoices-microservice-seller-secret`. `npm run verify:seller-legal-source`
checks that the Vault path has non-placeholder seller name/address plus at
least one company/tax/VAT identifier without printing values.
`npm run runtime:sync-seller-legal` applies the ExternalSecret only after those
checks pass, force-syncs it, and reruns the pre-consumer final-smoke gate. The
runtime sync was not executed because the seller legal Vault path is still
`[MISSING]`.

2026-07-02 continuation: Added a guarded final-smoke evidence verifier for the
approved synthetic fixture lane. `npm run verify:final-smoke-evidence` requires
`ORDER_ID`, runs `verify:final-smoke-prereqs` by default, then captures
sanitized evidence from `invoice_documents`, `invoice_event_records`, internal
invoice list/document endpoints, and the Payments read-only
`/payments/status/by-order-id` snapshot. Customer account and Logging evidence
are optional and require approved bearer tokens. Download-link rotation is not
part of the default read-only path; it requires
`VERIFY_DOWNLOAD_LINK_ROTATION=true` and `FINAL_SMOKE_APPROVED=true`. The
verifier was not run against a fixture because seller legal data and the
RabbitMQ consumer switch are still `[MISSING]`.

2026-07-02 continuation: During validation, Notifications had drifted to image
`localhost:5000/notifications-microservice:583da28`, which lacked invoices
service-token support and caused no-send invoice validation to return 401.
Redeployed and pinned `notifications-microservice` to immutable image
`localhost:5000/notifications-microservice:f855764`; rollout and health passed,
and `./scripts/check-invoices-documents-readiness.sh` again returns HTTP 201
for proforma and final with `mutation=false` and `providerCall=false`.
`npm run verify:consumer-enable-prereqs` now fails only on
`[MISSING: seller legal secret invoices-microservice-seller-secret]` while the
Orders consumer remains intentionally disabled.

2026-07-02 continuation: Hardened the related Notifications deploy source so
future invoice delivery validations do not regress to stale `:latest` image
behavior. Notifications commit `dc78446 fix: pin notifications deploy to
immutable image tag` changes `scripts/deploy.sh` to set the Kubernetes
deployment image to the immutable build tag and updates its deployment docs.
Validation in `notifications-microservice` passed: `bash -n scripts/deploy.sh`,
`npm run build`, focused auth/channel/notification tests, full `npm test
-- --runInBand`, `git diff --check`, and live
`./scripts/check-invoices-documents-readiness.sh`. No notification send or
provider call was run.

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
`[MISSING: FlipFlop runtime smoke proving authenticated central order
snapshots carry customer.authSubject]` and `[MISSING: Cliplot hosted Auth
callback/session contract before authenticated checkout can pass Auth subject]`.
Validation passed: focused account tests,
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
Runtime proof now confirms the deployed Orders workload includes that commit:
Kubernetes reports `localhost:5000/orders-microservice:537a103`,
`git merge-base --is-ancestor c4f1332 537a103` exited `0`, and
`npm run verify:invoices-read-boundary` plus
`npm run verify:create-order-contract` passed in `orders-microservice`.
FlipFlop authenticated checkout source now forwards the UUID-shaped local Auth
user id to central Orders as `customer.authSubject`. Remaining blockers are
runtime proof for that FlipFlop path and an approved Cliplot hosted Auth
callback/session contract before Cliplot can pass a customer Auth subject.

2026-07-02 continuation: Re-ran `npm run verify:consumer-enable-prereqs`.
Core runtime prerequisites, deployed invoices workload, public base URL,
Payments API key `payments:read` scope, Notifications token projection,
`invoices.documents` channel policy, and Notifications no-send validation all
passed. The gate still exits `1` only because `[MISSING: seller legal secret
invoices-microservice-seller-secret]`; keep `ORDERS_EVENTS_CONSUMER_ENABLED`
disabled until seller legal data exists.

2026-07-02 continuation: FlipFlop now has a guarded auth-subject runtime smoke
gate in commit `23b22e0 test: add auth subject orders smoke gate`.
`smoke:orders-auth-subject` is non-mutating by default, requires
`RUN_LIVE_AUTH_SUBJECT_ORDERS_SMOKE=1`,
`AUTH_SUBJECT_SMOKE_APPROVAL_ID`,
`AUTH_SUBJECT_SMOKE_CONFIRM=CREATE_READ_OPTIONAL_CANCEL`, and explicit
Catalog/Warehouse fixture ids before creating a synthetic central Orders row,
then reads the Orders snapshot to assert `customer.authSubject` persistence.
Default preflight proved `mutation=false` and blocked only on missing approval
inputs. Runtime proof remains `[MISSING]` until the approved smoke is executed.

## Preserved Intent

Orders remains canonical order truth and event producer. Payments remains
payment identity/reconciliation truth. Invoices owns issuance records, invoice
numbering, immutable invoice snapshots, document rendering, and delivery
attempt state.
