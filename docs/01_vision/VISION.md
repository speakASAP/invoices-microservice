# Vision: invoices-microservice

> Protected intent baseline. Human approval is required before changes to the approved project direction.

```yaml
id: VISION-invoices-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - ../00_constitution/CONSTITUTION.md
downstream:
  - ../../BUSINESS.md
  - ../17_governance/PROJECT_INVARIANTS.md
  - ../22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## one-sentence vision

Give the Alfares ecosystem one invoice issuance authority so every order reliably yields exactly one proforma invoice and exactly one final tax invoice that the customer can receive or download.

## problem statement

Order lifecycle events arrive repeatedly and can be replayed, and invoice numbering has legal uniqueness requirements. Without one issuance boundary, invoice generation logic would be duplicated across Orders, Payments and sales channels, risking duplicate invoice numbers, missing tax documents and invoices issued without complete legal data.

## target users

- Customers who need to receive or download their proforma and final tax invoices
- The business owner accountable for legally correct, non-duplicated tax documents
- `orders-microservice`, `payments-microservice` and `notifications-microservice`, which trigger, enrich and deliver invoice documents

## core user need

Customers and the business need a dependable, auditable invoice per order stage: a proforma invoice as soon as the order exists, and a final tax invoice as soon as it is paid, each with a unique number and retrievable document.

## key outcomes

- Exactly one proforma invoice and one final tax invoice per order
- Durable, duplicate-free annual invoice numbering per invoice type
- Idempotent handling of repeated or replayed Orders lifecycle events
- Retrievable invoice documents through guarded internal reads, opaque customer download tokens or authenticated customer-account access

## non-goals

- Owning orders, payments, notification channels or customer identity
- Executing refunds, credit notes or invoice corrections without an approved workflow
- Issuing invoices with incomplete legal seller or buyer data

## success criteria

- Every created order has exactly one proforma invoice; every paid order has exactly one final tax invoice
- Zero duplicate invoice numbers within each invoice type and year
- Replayed Orders events never produce a duplicate invoice record
- No customer address, provider payload, token or secret appears in logs

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: invoices-microservice-onboarding-approved
