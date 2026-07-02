# BPCP Holiday Discount Adoption

Status: service-local adoption contract
Date: 2026-07-02
Service: `invoices-microservice`
Central contract pack: `statex-ecosystem/docs/business-process-control-plane/`

## Role

Legal document renderer for discount lines from immutable order snapshot.

## Responsibilities

- Render holiday discount line from order snapshot.
- Avoid recalculating eligibility.
- Preserve tax/legal document invariants.

## Required interfaces

- Order read contract with appliedDiscounts.
- Invoice line rendering for discount amount and display name.
- Validation fixture for discounted order.

## Boundaries

- This service must not become the global owner of BPCP process definitions.
- This service must fail closed on invalid or unknown BPCP process versions.
- This service must keep existing domain ownership and invariants.
- This service must expose or document dry-run behavior before live execution.
- This service must not overwrite existing service contracts without an
  explicit integration owner and validation owner.

## Holiday Discount pilot expectations

- Recognize `holiday-discount-2026` only through versioned BPCP contracts.
- Preserve `processId`, `processVersion`, and `policyId` in every relevant
  decision, event, snapshot, log, or rendered experience.
- Support rollback by respecting BPCP pause and retired states.
- Keep process display and process execution separate where applicable.

## Blockers and unknowns

- [MISSING: confirmed invoice discount line schema]
- [MISSING: legal/tax display constraints for discounts]

## Validation evidence required before implementation is accepted

- Invoice fixture includes base subtotal, discount line, total.
- Invoice output remains stable if BPCP process later pauses.
- Existing invoice manifest/readiness checks pass.

## Parallel handoff

This adoption doc is safe for a focused service owner to implement in parallel
after the central BPCP schemas are accepted. The service owner must not edit
shared BPCP schemas directly; schema changes go through the BPCP integration
owner.
