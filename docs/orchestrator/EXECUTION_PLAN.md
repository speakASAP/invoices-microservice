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
- Source-selected MinIO/S3 document storage contract for future off-database
  immutable PDF objects.
- Optional Payments status and Notifications delivery clients.
- Auth-validated customer account listing/download access.
- Sanitized fail-open Logging integration.
- Runtime prerequisite and final smoke verifier gates.

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
| D | PDF/delivery/storage | source-ready-runtime-gated | delivery/storage owner | invoices + notifications docs/code | PDFKit generation, DB-backed PDF, secure PDF links, MinIO/S3 object-storage contract | runtime bucket, credentials, retention, DB object-reference migration |
| E | Account access | source-ready-runtime-gated | account owner | invoices account endpoints/tests | Auth subject/email scoped listing and download links | Orders source proof exists; runtime/caller proof gated |
| F | Logging contract | source-ready | observability owner | `src/common/logger.service.ts`, tests | sanitized `POST /api/logs`, fail-open transport | Logging workload ready |
| G | Runtime activation | approval-gated | platform/integration owner | Vault, DB, deploy config, final smoke | runtime prerequisite closure and final smoke | owner approval |

## Validation Plan

- `npm run build`
- `npm test`
- `npm run verify:contracts`
- `npm run verify:runtime-readiness`
- `git diff --check`
- `npm run verify:runtime-prereqs` after runtime provisioning
- `npm run verify:final-smoke-prereqs` after deploy/delivery/legal gates

## Gate Decision

Pre-coding gate: pass with documented runtime blockers. Source-only
implementation is allowed; deployment is blocked.
