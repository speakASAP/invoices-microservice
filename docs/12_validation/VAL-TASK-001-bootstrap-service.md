# VAL-TASK-001-bootstrap-service: Validate invoices-microservice bootstrap

```yaml
id: VAL-TASK-001-bootstrap-service
target: TASK-001-bootstrap-service
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
status: validated
validator: project owner
date: 2026-08-30
sensitive_data_classification: invoice, seller/buyer legal identity and customer contact metadata (never logged)
parallel_workstream_context: final-integration
```

## Summary

The invoices-microservice onboarding bootstrap is validated. The repository contains the required IPS adoption documents, a code-verified integration contract, governance records and state metadata for the runtime-service profile, and no unresolved placeholders remain in the required artifacts.

## Upstream goal

The task aligns with the approved goal in `../22_goal_impact/GOAL-IMPACT-TASK-001.md` and the protected product direction in `../../BUSINESS.md` and `../01_vision/VISION.md`: one invoice issuance authority producing exactly one proforma invoice and one final tax invoice per order.

## Acceptance criteria evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| Project adoption profile valid for planning | Pass | `python3 ../intent-preservation-system/scripts/validate_adoption_profile.py --root . --phase planning` exits 0 |
| Required sections present in every artifact | Pass | Document set includes business, system, vision, constitution, governance invariants, integration contract, and the bootstrap task, goal-impact, execution-plan and validation records |
| Integration decisions concrete and code-verified | Pass | `ips-adoption.json` and `docs/06_architecture/INTEGRATION_CONTRACT.md` cite real source files (`src/events/rabbitmq-orders.consumer.ts`, `src/invoices/orders-client.service.ts`, `src/invoices/payments-client.service.ts`, `src/invoices/notifications-client.service.ts`, `src/common/customer-auth.guard.ts`, `src/common/logger.service.ts`, `src/health.controller.ts`) for every required decision |
| State schema complete | Pass | `STATE.json` includes `schemaVersion`, `project`, `lifecycle`, `health`, `activeTask`, `lastUpdated`, `deployment`, `blockers`, `followUps` while preserving the three real outstanding blockers and the legacy history |
| Protected artifacts approved | Pass | `BUSINESS.md`, `docs/00_constitution/CONSTITUTION.md` and `docs/01_vision/VISION.md` each carry an `## Approval` section with a human owner and durable owner-confirmation evidence |

## Gate evidence

| Gate | Command | Result | Evidence |
| --- | --- | --- | --- |
| Adoption | `python3 ../intent-preservation-system/scripts/validate_adoption_profile.py --root . --phase planning` | Pass | Required sections and placeholders resolved; command output recorded at task closure |
| Pre-coding | Not run | Not applicable | No application code was changed by this documentation-only bootstrap task |
| Application | `npm test` | Not run in this onboarding gate | Application validation remains a downstream implementation-lifecycle concern |
| Integration | `npm run build` | Not run in this onboarding gate | Integration validation remains a downstream implementation-lifecycle concern |
| Deployment dry run | `DRY_RUN=1 ./scripts/deploy.sh` | Not run | Deployment remains subject to explicit owner approval; no deploy was requested for this task |

## Integration evidence

Every `required` decision (auth, PostgreSQL, logging, notifications, payments, orders, event-bus, docs-RAG, monitoring, backups) is backed by a concrete client, guard, controller, dependency or manifest reference. Every `not-applicable` decision (redis, AI, catalog, warehouse, invoices, object storage) is backed by a verified absence of a corresponding client, dependency or configuration in `src/`, `package.json`, `.env.example` and `k8s/`. The Orders events consumer is implemented and bound to both routing keys, and is currently switched off through `ORDERS_EVENTS_CONSUMER_ENABLED=false` in the production ConfigMap; this operational nuance is documented rather than treated as an absent integration.

## Invariant evidence

`docs/17_governance/PROJECT_INVARIANTS.md` records the one-invoice-per-type rule, transactional unique annual numbering, the legal-completeness requirement, the no-sensitive-data-in-logs rule and the owner-approval requirement for refunds and corrections. No source file implementing these rules (`src/invoices/invoices.service.ts`, `src/invoices/invoice-numbering.service.ts`, `src/common/logger.service.ts`) was modified by this task.

## Sensitive-data evidence

No secrets, tokens, Vault values, seller credentials or real customer data appear in any document created or modified by this task. All evidence cites file paths, environment variable names, route paths and role/guard names rather than runtime values.

## Replay and determinism evidence

The adoption baseline is deterministic: the same project intent, integration decisions and required sections are captured in a consistent set of repository documents, and re-running the adoption validator against an unchanged repository returns the same pass result. Issuance replay safety itself is unchanged and remains guaranteed by the `(orderId, invoiceType)` idempotency key.

## Issues and validation debt

No current-task issues remain. `docs/orchestrator/VALIDATION_DEBT.md` records `VD-001` (no open adoption debt) and `VD-002` (lifecycle-driven issuance cannot be smoke-tested end to end while the Orders events consumer switch is off in production). Neither blocks the current task.

## Deviations

None. The scope matched the task objective: documentation-only IPS adoption, with no application, schema, configuration or deployment change.

## Recommendation

Accept. The IPS adoption baseline is complete. Three project blockers remain outstanding and are recorded in `STATE.json`: the owner-approved durable object-storage rollout, the deployed authenticated Orders `customer.authSubject` proof, and the owner-approved refund/correction workflow.

## Traceability confirmation

The result remains aligned with the protected business intent in `../../BUSINESS.md` and the approved vision in `../01_vision/VISION.md`, and does not broaden the service's scope beyond the truthful invoice-issuance-boundary problem. See `TASK-001-bootstrap-service` for the originating task record.
