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
| A service core | active | invoices worker | `src/invoices`, DB entities, HTML documents | `npm run build`, `npm test` |
| B Orders read role | ready_parallel | Orders integration owner | add invoices service actor/read role without touching event payloads | Orders build + focused auth/read smoke |
| C runtime platform | dependency-gated | platform/secrets owner | DB, Vault, K8s manifests, ingress | dry-run + rollout after approval |
| D delivery/PDF | dependency-gated | invoices/notifications owner | PDF/storage + Notifications delivery | focused delivery validation |
| E account access | active | invoices account owner | Auth-validated customer invoice list and download-link rotation | focused account tests + contract verifier |

Shared contract owner: main coordinator. Merge order: A -> B -> C -> D.
