# Project Invariants: invoices-microservice

```yaml
id: PROJECT-INVARIANTS-invoices-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - ../../BUSINESS.md
  - ../../SYSTEM.md
  - ../01_vision/VISION.md
downstream:
  - ../01_vision/VISION.md
  - ../12_validation/VAL-TASK-001-bootstrap-service.md
```

## purpose

These invariants protect the invoice issuance intent for invoices-microservice and keep implementation grounded in the approved numbering, idempotency, legal-completeness and data-handling rules in `BUSINESS.md`.

## applicability

These invariants apply to Orders event handling, invoice issuance, invoice numbering, document rendering and download, delivery requests, and any workflow change that affects invoice records or cross-service trust boundaries.

## invariants

| ID | Level | Source | Rule | Forbidden outcome | Validation method | Gate |
|---|---|---|---|---|---|---|
| INV-INV-001 | business | `../../BUSINESS.md` | Exactly one invoice of a given type may exist per order; `(orderId, invoiceType)` is the durable issuance idempotency key. | A second proforma or final tax invoice issued for the same order. | Idempotency test replaying the same Orders event and a uniqueness constraint check on the issuance key. | pre-coding/deployment |
| INV-INV-002 | business | `../../BUSINESS.md` | Invoice numbers must be unique per invoice type and year and may only be allocated inside the transactional annual-sequence allocator. | A duplicate invoice number or a number allocated outside the transaction. | Numbering service test plus the unique constraint on the sequence counter table. | pre-coding/deployment |
| INV-INV-003 | constitutional | `../00_constitution/CONSTITUTION.md` | No invoice may be issued without the required legal seller and buyer data; missing data produces a blocked invoice record and a sanitized blocker instead of fabricated fields. | An issued invoice containing invented seller, buyer, VAT or address values. | Review of the issuance guard path and blocked-record behavior when seller/buyer configuration is incomplete. | pre-coding/deployment |
| INV-INV-004 | business | `../../BUSINESS.md` | Customer addresses, payment provider details, tokens and secrets must never be written to logs or documentation. | A log line or document containing a customer address, provider payload, token or secret. | Sensitive-key redaction pattern in `src/common/logger.service.ts` plus log-output review. | pre-coding/deployment |
| INV-INV-005 | constitutional | `../00_constitution/CONSTITUTION.md` | Refunds, credit notes and invoice corrections require a separate owner-approved workflow and must not be implemented implicitly. | Automated refund, credit-note or correction issuance without recorded owner approval. | Scope review of any change touching issuance types or numbering. | pre-coding/deployment |

## exceptions

No exception is granted for duplicate invoice numbers, duplicate invoices of the same type, invoices with fabricated legal data, or logging sensitive customer data. Any future exception requires explicit owner approval documented in a governance amendment under `docs/17_governance/`.

## review cadence

Review these invariants whenever the issuance flow, numbering allocator, event contract, document access model or a cross-service authorization boundary changes, and before any deployment that touches issuance or numbering logic.
