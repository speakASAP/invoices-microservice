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
| C runtime provisioning | active_parallel | platform/secrets owner | Vault path, invoices DB, deploy preflight; dependency workloads currently ready | `npm run verify:runtime-prereqs` after provisioning |
| D Notifications delivery policy | source-ready-runtime-gated | notifications owner | invoices service actor plus `invoices.documents` channel policy; no provider send | commit `676b662`, validate endpoint/source tests, no-send readiness script |
| G final smoke runbook | dependency-gated | integration owner | order-created proforma, payment-completed final, account access, logging evidence | `docs/orchestrator/FINAL_RUNTIME_SMOKE_PLAN.md`; run only after runtime prereqs pass |
| E account access | source-ready-runtime-gated | invoices account owner | Auth-validated subject/email account-scoped invoice listing and download-link rotation | focused account tests + contract verifier |
| F PDF/durable storage | source-ready-runtime-gated | invoices/storage owner | DB-backed PDF bytes/checksum and secure PDF links; external object storage remains future | PDFKit tests + contract verifier |

Shared contract owner: main coordinator. Merge order: source contracts -> runtime provisioning -> Notifications runtime channel policy -> final smoke -> deploy.
