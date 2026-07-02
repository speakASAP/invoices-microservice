# Execution Plan: Goal 1 Invoices Issuance MVP

```yaml
id: EP-INVOICES-GOAL-1
status: in-progress
owner: Invoices coordinator
created: 2026-07-02
last_updated: 2026-07-02
parallelization_strategy: parallel_goals
contract_schema_impact: creates
replay_determinism_impact: required
```

## Goal Impact

Create the bounded invoices service so every order can receive a proforma and
final tax invoice without duplicating Orders or Payments ownership.

## Scope

- New `invoices-microservice` repository.
- Invoice document, event-record, and sequence persistence.
- Orders event validation and RabbitMQ consumer.
- Idempotent proforma/final issuance.
- HTML and PDF document rendering with tokenized document access.
- Optional Payments status and Notifications delivery clients.

## Non-Goals

- No refunds, credit notes, corrections, or cancellation documents.
- No real payment creation or provider calls.
- No real notification send during source validation.
- No production deployment until blockers are resolved.

## Parallel Execution Strategy

| Workstream | Goal | Can start in parallel? | Owner | Allowed files | Expected output | Dependency |
| --- | --- | --- | --- | --- | --- | --- |
| A | Service core | yes | invoices worker | `invoices-microservice/**` | buildable MVP | none |
| B | Orders service-role read | yes after A contract | Orders integration owner | `orders-microservice/src/auth/*`, `src/orders/orders.controller.ts`, docs | approved internal read path | avoid dirty event files |
| C | Runtime manifests/secrets | blocked | platform owner | `k8s/*`, Vault/ESO | deployable config | DB and token decisions |
| D | PDF/delivery | source-ready-runtime-gated | delivery owner | invoices + notifications docs/code | PDFKit generation, DB-backed PDF, secure PDF links | external object storage policy |

## Validation Plan

- `npm run build`
- `npm test`
- `npm run verify:contracts`
- `git diff --check`

## Gate Decision

Pre-coding gate: pass with documented runtime blockers. Source-only
implementation is allowed; deployment is blocked.
