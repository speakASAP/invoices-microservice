# EP-TASK-001-bootstrap-service: Bootstrap invoices-microservice

```yaml
id: EP-TASK-001-bootstrap-service
status: implemented
source_task: ../11_tasks/TASK-001-bootstrap-service.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
validation:
  - ../12_validation/VAL-TASK-001-bootstrap-service.md
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
parallelization_strategy: single_agent
required_gates:
  - adoption
  - pre-coding
```

## Upstream traceability

- `../../BUSINESS.md` — invoice issuance intent, goals and constraints.
- `../../SYSTEM.md` — service responsibilities, numbering model and dependencies.
- `../01_vision/VISION.md` — target outcome and success criteria.
- `../11_tasks/TASK-001-bootstrap-service.md` — bootstrap task record.
- `../22_goal_impact/GOAL-IMPACT-TASK-001.md` — mapped impact and measurable outcome.

## Scope

Complete the IPS onboarding baseline for invoices-microservice: project intent, governance, integration decisions, state metadata and validation records, restructuring real pre-existing repository facts rather than inventing new business scope.

## Non-goals

- Public API, event contract, numbering or database schema changes.
- Rewriting the approved product intent in `BUSINESS.md` beyond restructuring it into the required sections.
- Enabling the Orders events consumer or altering any runtime configuration value.
- Deploying, rolling out, or running any `kubectl`, `docker` or `deploy.sh` command as part of this task.

## Project invariants

- `INV-INV-001`: one invoice per type per order — preserved by not touching `src/invoices/invoices.service.ts` or the issuance idempotency key.
- `INV-INV-002`: transactional unique annual numbering — preserved by not touching `src/invoices/invoice-numbering.service.ts` or the sequence counter entity.
- `INV-INV-003`: no invoice without complete legal data — preserved; no seller/buyer handling was changed.
- `INV-INV-004`: no sensitive data in logs — preserved; documentation contains no real customer, seller or token values.
- `INV-INV-005`: refunds and corrections stay owner-gated — preserved; no correction behavior was introduced.

## Sensitive-data handling

- Keep customer addresses, contact details, provider payloads and seller secret values out of every document and validation record produced by this task.
- Use only sanitized architecture descriptions and references (file paths, environment variable names, route paths) as evidence.
- Never print Vault values, service tokens or API keys.

## Contract validation plan

- Validate that `ips-adoption.json` records a concrete decision for all sixteen capabilities, and for every `required` capability a contract, configuration, failure mode and validation string.
- Confirm the human-readable table in `../06_architecture/INTEGRATION_CONTRACT.md` matches the `ips-adoption.json` decisions exactly.
- Confirm every `required` decision is backed by a real code, manifest or dependency reference rather than an assumption from an environment variable name alone, and that every `not-applicable` decision is backed by a verified absence.

## Replay and determinism plan

- Keep the adoption and validation documents deterministic and reviewable; re-running the adoption validator against an unchanged repository returns the same pass result.
- No runtime behavior, migration or event contract was changed, so no replay or determinism risk is introduced to the issuance pipeline itself.

## Files to inspect

- `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `README.md`, `TASKS.md`, `STATE.json`, `.env.example`, `package.json`, `deploy.config.sh`
- `src/invoices/invoices.service.ts`, `src/invoices/invoices.controller.ts`, `src/invoices/invoice-numbering.service.ts`, `src/invoices/orders-client.service.ts`, `src/invoices/payments-client.service.ts`, `src/invoices/notifications-client.service.ts`, `src/invoices/invoice-pdf.service.ts`, `src/events/rabbitmq-orders.consumer.ts`, `src/common/logger.service.ts`, `src/common/internal-auth.guard.ts`, `src/common/customer-auth.guard.ts`, `src/health.controller.ts`
- `k8s/configmap.yaml`, `k8s/external-secret.yaml`, `k8s/seller-external-secret.yaml`

## Files to create

- `docs/00_constitution/CONSTITUTION.md`
- `docs/01_vision/VISION.md`
- `docs/06_architecture/INTEGRATION_CONTRACT.md`
- `docs/17_governance/PROJECT_INVARIANTS.md`
- `docs/11_tasks/TASK-001-bootstrap-service.md`
- `docs/22_goal_impact/GOAL-IMPACT-TASK-001.md`
- `docs/21_execution_plans/EP-TASK-001-bootstrap-service.md`
- `docs/12_validation/VAL-TASK-001-bootstrap-service.md`
- `docs/orchestrator/VALIDATION_DEBT.md`
- `AGENT_OPERATIONS.md`, `CLAUDE.md`, `ips-adoption.json`

## Files to modify

- `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `TASKS.md`, `STATE.json`, `README.md`

## Files that must not be modified

- `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/IMPLEMENTATION_STATE.md`, and the pre-existing `docs/orchestrator/INTENT.md`, `GOALS.md`, `PLAN.md`, `PROJECT_INVARIANTS.md`, `CONTEXT_PACKAGE.md`, `EXECUTION_PLAN.md`, `PRE_CODING_GATE.md`, `READINESS_GATES.md`, `PROMPTS.md`, `STATUS.md`, `RUNTIME_ACTIVATION_PLAN.md`, `FINAL_RUNTIME_SMOKE_PLAN.md`, `INVOICE_DOCUMENT_STORAGE_CONTRACT.md` — the parallel documentation pack, which coexists with the canonical IPS tree.
- Any application source under `src/`, plus `k8s/`, `Dockerfile`, `deploy.config.sh`, `package.json` and `.env.example`.

## Implementation steps

1. Read the existing root documents, `.env.example`, `package.json`, `k8s/` manifests and the relevant `src/` files to establish verified facts.
2. Run the non-destructive scaffolder to create missing IPS artifact skeletons.
3. Restructure `BUSINESS.md` and `SYSTEM.md` into the required sections, preserving all real facts, and add the protected-artifact frontmatter and `## Approval` section where required.
4. Fill `docs/00_constitution/CONSTITUTION.md`, `docs/01_vision/VISION.md`, `docs/17_governance/PROJECT_INVARIANTS.md` and `docs/06_architecture/INTEGRATION_CONTRACT.md` with project-specific, code-verified content.
5. Fill `ips-adoption.json` with a concrete decision for every capability, each verified against `src/`, `package.json`, `.env.example` or `k8s/`.
6. Fill the four bootstrap documents (this plan, the task, the goal impact and the validation report) with mutual traceability references.
7. Update `README.md`, `AGENTS.md`, `AGENT_OPERATIONS.md`, `TASKS.md` and `STATE.json` to add the required sections and schema without discarding the pre-existing orchestrator instructions or the real outstanding blockers.
8. Replace the scaffolded `docs/orchestrator/VALIDATION_DEBT.md` placeholders with concrete ledger entries.
9. Run the IPS planning validator and resolve every remaining finding.

## Parallel execution

| Workstream | Status | Owner role | Allowed files | Dependencies | Validation | Merge order |
| --- | --- | --- | --- | --- | --- | --- |
| Documentation and contracts | complete | worker agent | all files listed under Files to create and Files to modify above | approved product intent in the pre-existing `BUSINESS.md` and `SYSTEM.md` | IPS adoption validator | first |
| Durable document storage | blocked | integration owner | future storage module and migration | owner approval for bucket provisioning, credentials and retention policy | storage contract smoke test (future task) | not scheduled |
| Authenticated Orders snapshot proof | dependency-gated | integration owner | evidence documents only | deployed authenticated checkout runtime evidence | snapshot field verification (future task) | not scheduled |
| Refund and correction workflow | blocked | integration owner | future corrections module | owner-approved corrections and credit-note policy | corrections acceptance tests (future task) | not scheduled |

Shared files across future lanes: `SYSTEM.md`, `TASKS.md`, `STATE.json` and `docs/06_architecture/INTEGRATION_CONTRACT.md`. Integration owner for those shared files is the project owner; merge order follows the table above.

## Blockers

- Owner-approved runtime MinIO/S3 document storage rollout, object-reference migration application and backfill plan is not yet authorized, so durable object storage stays out of scope and `object-storage` is recorded as not applicable today.
- Deployed authenticated checkout and runtime proof that new Orders snapshots persist `customer.authSubject` across active channels is not yet available.
- The owner-approved refund, correction and credit-note workflow does not exist yet.

None of these blocked this documentation-only task; all three are recorded as outstanding project blockers in `../../STATE.json`.

## Test plan

- Validate the adoption profile structure and confirm no unresolved placeholders remain in the required artifacts.
- Confirm every required section and status field is present in every artifact.
- Confirm the bootstrap task, goal impact, execution plan and validation records are mutually traceable.

## Validation plan

- Run the IPS adoption validation with `--phase planning`.
- Record the exact command result in `../12_validation/VAL-TASK-001-bootstrap-service.md`.
- Record residual validation debt in `../orchestrator/VALIDATION_DEBT.md`.

## Gate commands

Run from the adopting repository:

```bash
python3 ../intent-preservation-system/scripts/validate_adoption_profile.py --root . --phase planning
```

## Documentation updates

- `README.md`, `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `AGENT_OPERATIONS.md`, `CLAUDE.md`, `TASKS.md`, `STATE.json`
- `docs/00_constitution/CONSTITUTION.md`, `docs/01_vision/VISION.md`
- `docs/06_architecture/INTEGRATION_CONTRACT.md`, `docs/17_governance/PROJECT_INVARIANTS.md`
- `docs/11_tasks/TASK-001-bootstrap-service.md`, `docs/12_validation/VAL-TASK-001-bootstrap-service.md`, `docs/21_execution_plans/EP-TASK-001-bootstrap-service.md`, `docs/22_goal_impact/GOAL-IMPACT-TASK-001.md`
- `docs/orchestrator/VALIDATION_DEBT.md`, `ips-adoption.json`

## Rollback plan

If a documentation change is found to misstate the approved invoice policy, revert the affected file to its pre-task version with `git checkout` and re-run the planning validator before continuing. No runtime, numbering or schema rollback is needed because no application code was changed.

## Handoff

The completed documents, the validator result and the three outstanding owner-gated or dependency-gated blockers are handed off to the project owner. No further worker action is required to close this bootstrap task. The next scoped work should be whichever blocked lane the owner authorizes first.

## Completion checklist

- [x] Protected intent approved
- [x] Adoption profile valid
- [x] Integration decisions complete
- [x] Documentation implementation complete
- [x] Required integrations reviewed against source code
- [ ] Deployment dry run passes (not applicable — documentation-only task, no deploy requested)
- [x] Validation report complete
