# Tasks: invoices-microservice

This file is the concise human-readable work queue. Detailed task contracts live under `docs/11_tasks/`; execution plans and validation reports are linked from those task documents. The pre-existing `docs/IMPLEMENTATION_ORCHESTRATOR.md` and `docs/orchestrator/*` pack continues to track detailed implementation-orchestrator state.

## Active
- No active tasks. Goal 1 (invoice issuance MVP) is runtime-complete and the IPS adoption baseline is closed.

## Ready Next
- Prepare the durable document storage design so it can start immediately once the owner authorizes MinIO/S3 bucket provisioning, credentials and retention policy.

## Blocked
- Goal 2 durable storage runtime lane: owner approval for MinIO/S3 bucket provisioning, service credentials, retention policy, object-reference migration application, upload/presign runtime and backfill/rollback plan has not been granted.
- Goal 3 authenticated Orders proof lane: deployed authenticated checkout/runtime evidence that new Orders snapshots persist `customer.authSubject` across active channels is not yet available.
- Goal 4 corrections lane: the owner-approved refund/correction workflow, credit-note numbering and linkage policy does not exist yet.

## completed

- [x] 2026-08-30 `TASK-001-bootstrap-service` — IPS adoption baseline completed: business/system/vision/constitution, integration contract, governance invariants, bootstrap task/goal-impact/execution-plan/validation records, and `ips-adoption.json`/`STATE.json` brought into the required schema.
- [x] 2026-07-06 goal-1-runtime-deployed-and-final-smoke-verified
- [x] 2026-07-02 Initial service scaffold, invoice issuance model, event contract, and implementation plan.

## handoff

Current machine-readable state: [`STATE.json`](STATE.json).
Bootstrap adoption artifacts: [`docs/11_tasks/TASK-001-bootstrap-service.md`](docs/11_tasks/TASK-001-bootstrap-service.md), [`docs/22_goal_impact/GOAL-IMPACT-TASK-001.md`](docs/22_goal_impact/GOAL-IMPACT-TASK-001.md), [`docs/21_execution_plans/EP-TASK-001-bootstrap-service.md`](docs/21_execution_plans/EP-TASK-001-bootstrap-service.md), and [`docs/12_validation/VAL-TASK-001-bootstrap-service.md`](docs/12_validation/VAL-TASK-001-bootstrap-service.md).
