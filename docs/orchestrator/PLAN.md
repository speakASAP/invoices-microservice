# Invoices Plan

## Architecture

`orders.events` is the trigger plane. `invoices-microservice` binds a queue to
`orders.order.created.v1` and `orders.order.paid.v1`. The event contains only
safe identifiers and small snapshots. The service fetches full order details
from Orders through an approved internal service role before issuing a legal
document.

Orders events remain trigger-only and must not carry customer, billing,
provider, or address payloads for invoice generation.

## Cross-Service Contracts

| Service | Contract |
| --- | --- |
| Orders | Emits lifecycle events and exposes authorized order snapshot reads. |
| Payments | Updates Orders on payment completion; optional DB snapshot read by order id. |
| Notifications | Sends invoice-ready messages when configured. |
| Logging | Receives sanitized operational logs. |
| Auth | Validates customer bearer tokens for account-scoped invoice listing/download; reusable invoice profiles remain future input. |

## Parallel Execution

| Workstream | Status | Owner | Scope | Validation |
| --- | --- | --- | --- | --- |
| A service core | source-ready | invoices worker | `src/invoices`, DB entities, HTML documents | `npm run build`, `npm test`, `npm run verify:contracts` |
| B Orders read role | source-ready-runtime-gated | Orders integration owner | invoices service actor/read role without event payload expansion | Orders source evidence plus runtime token projection |
| C runtime provisioning | complete | platform/secrets owner | Vault path, invoices DB, deploy preflight, deploy, and consumer enablement are live | `npm run verify:runtime-prereqs`, `npm run verify:consumer-enable-prereqs`, `npm run verify:seller-legal-source` |
| D Notifications delivery policy | source-ready-runtime-gated | notifications owner | invoices service actor plus `invoices.documents` channel policy; no provider send | commit `676b662`, validate endpoint/source tests, no-send readiness script |
| G final smoke runbook | complete | integration owner | order-created proforma, payment-completed final, and internal evidence verified; optional customer/logging/token-rotation evidence intentionally deferred | `docs/orchestrator/FINAL_RUNTIME_SMOKE_PLAN.md`, `npm run verify:final-smoke-evidence` |
| E account access | source-ready-runtime-gated | invoices account owner | Auth-validated subject/email account-scoped invoice listing and download-link rotation | focused account tests + contract verifier |
| F PDF/durable storage | source-ready-runtime-gated | invoices/storage owner | DB-backed PDF bytes/checksum, secure PDF links, and selected MinIO/S3 immutable object-storage contract; runtime bucket/client/migration remain gated | PDFKit tests + contract verifier |
| H Logging contract | source-ready | invoices observability owner | sanitized `POST /api/logs` payload to Logging, fail-open transport | `test/logger.service.spec.ts`, `npm run verify:contracts` |

Shared contract owner: main coordinator. Merge order: source contracts -> runtime provisioning -> Notifications runtime channel policy -> deploy -> final smoke. Goal 1 is now runtime-complete; runtime activation details live in `docs/orchestrator/RUNTIME_ACTIVATION_PLAN.md`.
