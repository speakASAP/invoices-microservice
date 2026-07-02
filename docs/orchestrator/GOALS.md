# Invoices Goals

## Goal 1: Invoices Issuance MVP

Status: active

- [x] Create service scaffold and IPS pack.
- [x] Add invoice document, event idempotency, and sequence entities.
- [x] Add Orders event validation.
- [x] Add proforma/final issuance flow with blocked-record behavior.
- [x] Add HTML document rendering and tokenized download endpoint.
- [x] Validate build/tests on remote.
- [ ] Resolve runtime DB/Vault blockers and delivery policy gates.
- [x] Add dependency-gated final runtime smoke plan.
- [ ] Deploy only after runtime blockers are closed.

## Goal 2: PDF And Durable Storage

Status: dependency-gated

- [ ] Choose PDF rendering library/runtime.
- [ ] Choose object storage/attachment contract.
- [ ] Store immutable PDF object references.
- [ ] Deliver PDF or secure download link through Notifications.

## Goal 3: Customer Account Access

Status: dependency-gated

- [ ] Integrate with Auth/customer account after Auth invoice-profile/address
      wallet APIs exist.
- [x] Provide source-level account-scoped invoice listing/download by Auth
      validated customer email.

## Goal 4: Corrections And Credit Notes

Status: blocked

- [ ] Owner-approved refund/correction workflow.
- [ ] Credit note numbering and linkage.
