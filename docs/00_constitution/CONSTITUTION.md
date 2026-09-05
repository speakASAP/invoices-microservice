# Project Constitution: invoices-microservice

> Protected document. Human approval is required. AI agents may draft only from
> approved source material and must not modify the approved baseline directly.

```yaml
id: CONSTITUTION-invoices-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream: []
downstream:
  - ../01_vision/VISION.md
  - ../17_governance/PROJECT_INVARIANTS.md
```

## purpose

This constitution protects the approved intent for invoices-microservice as the single invoice issuance authority of the Alfares e-commerce backbone: one proforma invoice and one final tax invoice per order, one durable numbering authority, and auditable document delivery.

## constitutional principles

### intent preservation

Every implementation artifact must trace back to the approved issuance intent in `BUSINESS.md`: exactly one proforma invoice per created order, exactly one final tax invoice per paid order, and customer access to the generated documents.

### human-controlled change

Refunds, credit notes and invoice corrections are separate owner-approved workflows. Changes to invoice numbering, issuance rules or legal-data requirements require explicit human approval; AI agents may not automate these decisions.

### scope boundaries

invoices-microservice remains focused on invoice issuance, numbering, rendering, download links and delivery attempts. It does not take ownership of orders, payments, notification channels or customer identity.

### legal completeness

An invoice must never be issued without the required legal seller and buyer data. When required data is missing, the service records a blocked invoice and a sanitized blocker instead of fabricating fields.

### data and security

- Customer addresses, payment provider details, tokens and secrets must never be logged.
- Secrets, credentials and private evidence must never be committed to Git or exposed in documentation.

### validation

No task is complete without evidence against its acceptance criteria, the issuance idempotency keys and the numbering uniqueness rule.

## amendment process

1. Create an amendment proposal under `docs/17_governance/` or a reviewed equivalent path.
2. Explain the change, reason, affected artifacts and compatibility impact.
3. Obtain human approval.
4. Update dependent artifacts and rerun the relevant validation.

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: invoices-microservice-onboarding-approved
