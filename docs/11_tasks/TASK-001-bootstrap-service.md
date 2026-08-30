# TASK-001-bootstrap-service: Bootstrap invoices-microservice

```yaml
id: TASK-001-bootstrap-service
status: completed
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
upstream:
  - ../../BUSINESS.md
  - ../../SYSTEM.md
  - ../01_vision/VISION.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
execution_plan:
  - ../21_execution_plans/EP-TASK-001-bootstrap-service.md
project_invariant_impact: preserves
sensitive_data_classification: invoice, seller/buyer legal identity and customer contact metadata (never logged)
contract_schema_impact: creates
replay_determinism_impact: affected
parallel_workstream_context: final-integration
required_gates:
  - adoption
  - pre-coding
```

## Objective

Complete the IPS documentation-adoption baseline for invoices-microservice, an already-running production invoice issuance service, and review its real ecosystem integrations against the source code so the repository matches the standard applied to `cv-tuning`, `runlayer`, `wisdom-quotes` and `orders-microservice`.

## Upstream links

- `../../BUSINESS.md` — approved invoice issuance intent, goals and constraints.
- `../../SYSTEM.md` — service responsibilities, numbering model and dependency boundaries.
- `../01_vision/VISION.md` — protected vision and success criteria for a single issuance authority.

## Goal impact

See `../22_goal_impact/GOAL-IMPACT-TASK-001.md`. This task lets the service pass the IPS adoption gate as a truthful record of an already-running production issuance boundary, not as a new feature.

## Project invariant impact

The task preserves `INV-INV-001`–`INV-INV-005` in `../17_governance/PROJECT_INVARIANTS.md`: the one-invoice-per-type rule, transactional unique numbering, the legal-completeness requirement, the no-sensitive-data-in-logs rule and the owner-approval requirement for refunds and corrections. No invariant was weakened.

## Sensitive-data classification

The service handles invoice content, seller and buyer legal identity and customer contact metadata. Documentation and validation evidence produced by this task contain no real customer data, seller secrets or tokens — only sanitized architecture descriptions, environment variable names and code references.

## Contract and schema impact

This task creates the repository adoption contract (`ips-adoption.json`), the human-readable integration contract, and the required governance, task, plan and validation metadata. It does not change any runtime API, event contract or database schema.

## Replay and determinism impact

The task is documentation-only and deterministic: re-running the adoption validator against the same repository state returns the same pass result. It does not affect the issuance replay determinism already guaranteed by the `(orderId, invoiceType)` idempotency key under `INV-INV-001`.

## Scope

- Complete the required root IPS adoption artifacts (`README.md`, `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `AGENT_OPERATIONS.md`, `CLAUDE.md`, `TASKS.md`, `STATE.json`).
- Complete protected governance content (`docs/00_constitution/CONSTITUTION.md`, `docs/01_vision/VISION.md`, `docs/17_governance/PROJECT_INVARIANTS.md`) with human-approved status and durable evidence.
- Complete the integration contract and `ips-adoption.json` with real, code-verified capability decisions for all sixteen ecosystem capabilities.
- Complete this bootstrap task, its goal impact, execution plan and validation record.
- Replace the scaffolded `docs/orchestrator/VALIDATION_DEBT.md` placeholders with concrete ledger entries.
- Migrate `STATE.json` from the legacy schema to the IPS schema while preserving the three real owner-gated and dependency-gated blockers.

## Non-goals

- Implementing new invoice features, endpoints, numbering behavior or storage backends.
- Enabling the Orders events consumer or changing any runtime configuration.
- Removing or replacing the pre-existing `docs/IMPLEMENTATION_ORCHESTRATOR.md` and `docs/orchestrator/*` documentation pack, which coexists with the canonical IPS artifact set.
- Deploying, rolling out, or running any `kubectl`, `docker` or `deploy.sh` command.

## Acceptance criteria

- [x] The project adoption profile is valid for the planning gate (`validate_adoption_profile.py --phase planning` exits 0).
- [x] Every required root and `docs/` artifact exists with all required section headings and meaningful content.
- [x] `ips-adoption.json` records a concrete `required`/`not-applicable` decision, with contract, configuration, failure mode and validation for every required capability, each backed by verified source code or manifests.
- [x] `STATE.json` matches the IPS schema while preserving the real production history and the three genuine outstanding blockers.
- [x] Protected artifacts (`BUSINESS.md`, `docs/00_constitution/CONSTITUTION.md`, `docs/01_vision/VISION.md`) carry an `## Approval` section with a concrete human owner and durable evidence.

## Required context

- `../../BUSINESS.md`
- `../../SYSTEM.md`
- `../06_architecture/INTEGRATION_CONTRACT.md`
- `../17_governance/PROJECT_INVARIANTS.md`
- `../21_execution_plans/EP-TASK-001-bootstrap-service.md`
- `/home/ssf/Documents/Github/intent-preservation-system/docs/24_onboarding/PROJECT_ADOPTION_STANDARD.md`
- `/home/ssf/Documents/Github/intent-preservation-system/docs/24_onboarding/PROJECT_DOCUMENT_SET.md`

## Validation task

Validation report: `../12_validation/VAL-TASK-001-bootstrap-service.md`.

## Required gates

| Gate | Command or evidence | Blocks on |
| --- | --- | --- |
| Adoption | `python3 ../intent-preservation-system/scripts/validate_adoption_profile.py --root . --phase planning` | Missing or incomplete project documents or integration decisions |
| Pre-coding | Not run for this documentation-only bootstrap task; no code change is proposed | Traceability, invariants, scope or sensitive-data violations |
| Application | Not applicable — no application code changed by this task | Implementation regression |
| Integration | Not applicable — no runtime integration changed by this task | Broken required integration |

## Parallel workstream context

- Ready now: all documentation and governance artifacts in this task, completed in this session by a single agent.
- Dependency-gated: the authenticated Orders `customer.authSubject` snapshot proof lane, which needs deployed checkout evidence.
- Blocked: the durable object-storage rollout lane and the refund/correction workflow lane, both awaiting owner approval.
- Final integration: this task itself is the final integration for the IPS adoption baseline; no further workstream is required to close it.
