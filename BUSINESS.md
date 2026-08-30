# Business: invoices-microservice
>
> ⚠️ IMMUTABLE BY AI unless the owner explicitly updates invoice policy. Protected business baseline; human approval is required before changes to the approved product scope.

```yaml
id: BUSINESS-invoices-microservice
status: approved
owner: project owner
created: 2026-07-02
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - docs/01_vision/VISION.md
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - SYSTEM.md
  - docs/22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## problem

Every order sold through the Alfares ecosystem needs two legally distinct documents: a proforma invoice at order creation and a final tax invoice once the order is paid. Without a single issuance authority, invoice numbering, duplicate prevention and document delivery would be reimplemented inconsistently inside Orders, Payments and each sales channel, producing duplicate or missing invoice numbers and untraceable tax documents.

## target users and stakeholders

- Customers, who must be able to receive or download the generated proforma and final tax invoice documents
- The business owner, who is accountable for correct, non-duplicated, legally complete tax documents
- `orders-microservice`, which supplies the order and billing snapshot and emits the lifecycle events that trigger issuance
- `payments-microservice`, whose payment status snapshot optionally enriches the final tax invoice
- `notifications-microservice`, which delivers the generated document link to the customer
- `auth-microservice`, which authenticates customer-account access to a customer's own invoice documents

## value proposition

invoices-microservice gives the ecosystem one invoice issuance boundary with one durable numbering authority, so every order reliably produces exactly one proforma invoice and exactly one final tax invoice, with idempotent event handling and auditable document delivery.

## goals

- Generate exactly one proforma invoice per order when the order is created
- Generate exactly one final tax invoice per order when the order is paid
- Allocate invoice numbers from separate, durable annual sequences with no duplicates
- Let customers receive or download the generated documents through a delivery link or an authenticated customer-account read
- Keep issuance idempotent against repeated or replayed Orders lifecycle events

## non-goals

- Owning order records, order item snapshots or order lifecycle state (owned by `orders-microservice`)
- Processing payments, provider reconciliation or refund execution (owned by `payments-microservice`)
- Owning outbound delivery channels and templates (owned by `notifications-microservice`)
- Owning customer identity and profile data (owned by `auth-microservice`)
- Executing refunds, credit notes or invoice corrections, which are separate owner-approved workflows

## success metrics

- Every order that reaches the created state has exactly one proforma invoice record
- Every order that reaches the paid state has exactly one final tax invoice record
- Zero duplicate invoice numbers across both annual sequences
- No customer address, payment provider detail, token or secret ever appears in service logs
- No invoice is issued with incomplete legal seller or buyer data; such orders produce a blocked invoice record instead

## business constraints

- Do not create real invoices without required legal seller and buyer data
- Do not duplicate invoice numbers
- Do not generate a second invoice of the same type for the same order
- Do not log customer addresses, payment provider details, tokens, or secrets
- Refunds, credit notes, and corrections are separate owner-approved workflows
- Secrets and tokens must never be committed to Git or written into documentation
- Production deployment follows the shared ecosystem deployment queue and approval model

## approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: invoices-microservice-onboarding-approved
