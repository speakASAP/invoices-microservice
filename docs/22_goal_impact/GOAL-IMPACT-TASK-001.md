# GOAL-IMPACT-TASK-001: Bootstrap invoices-microservice

```yaml
id: GOAL-IMPACT-TASK-001
artifact_type: task
artifact_id: TASK-001-bootstrap-service
artifact_path: ../11_tasks/TASK-001-bootstrap-service.md
primary_goal: "Give the Alfares ecosystem one invoice issuance authority so every order reliably yields exactly one proforma invoice and exactly one final tax invoice that the customer can receive or download."
secondary_goals:
  - "Bring invoices-microservice into full IPS adoption compliance, matching cv-tuning, runlayer, wisdom-quotes and orders-microservice."
impact_level: "high"
status: validated
```

## Goal

This task advances the approved vision in `../01_vision/VISION.md` and the business intent in `../../BUSINESS.md` by giving invoices-microservice a complete, validator-passing IPS documentation baseline that truthfully describes its production role as the ecosystem's invoice issuance boundary.

## Contribution

The bootstrap task restructures the service's existing, real business and system facts into the canonical IPS artifact set, adds the required governance, integration-contract and bootstrap task/plan/validation records, and reconciles `ips-adoption.json` and `STATE.json` with the required schema — without inventing business scope or claiming integrations that are absent from the codebase. Capability decisions were verified against `src/`, `package.json`, `.env.example` and `k8s/` rather than inferred from environment variable names.

## Contribution to blockers

The three genuine outstanding items (durable object-storage rollout, authenticated Orders `customer.authSubject` proof, and the refund/correction workflow) were migrated verbatim in meaning from the legacy `STATE.json` into the IPS schema and restated as named open items in `../../SYSTEM.md` and `../../TASKS.md`, so they remain visible instead of being silently resolved.

## Success metric

The project completes the IPS adoption validator (`--phase planning`) without unresolved placeholders, includes every required governance and bootstrap artifact, and records a concrete, code-verified integration decision for all sixteen ecosystem capabilities.

## Invariant compatibility

This task preserves every invariant in `../17_governance/PROJECT_INVARIANTS.md` (`INV-INV-001`–`INV-INV-005`): one invoice per type per order, transactional unique annual numbering, the legal-completeness requirement, the no-sensitive-data-in-logs rule and the owner-approval requirement for refunds and corrections. No invariant was relaxed to make the validator pass.

## Upstream and downstream links

- Upstream: `../../BUSINESS.md` (goals, non-goals, constraints, success metrics) and `../01_vision/VISION.md` (one-sentence vision, success criteria).
- Task: `../11_tasks/TASK-001-bootstrap-service.md`
- Plan: `../21_execution_plans/EP-TASK-001-bootstrap-service.md`
- Validation: `../12_validation/VAL-TASK-001-bootstrap-service.md`

## Validation method

The objective is validated by running `validate_adoption_profile.py --root . --phase planning` and confirming it exits 0 with no `ERROR:` lines, and by manually confirming every capability decision in `ips-adoption.json` is backed by a real code, manifest or configuration reference cited in `../06_architecture/INTEGRATION_CONTRACT.md`.
