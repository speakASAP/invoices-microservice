# Invoices Goals

## Goal 1: Invoices Issuance MVP

Status: active

- [x] Create service scaffold and IPS pack.
- [x] Add invoice document, event idempotency, and sequence entities.
- [x] Add Orders event validation.
- [x] Add proforma/final issuance flow with blocked-record behavior.
- [x] Add HTML document rendering and tokenized download endpoint.
- [x] Add DB-backed PDF rendering, checksum persistence, and PDF download endpoints.
- [x] Validate build/tests on remote.
- [ ] Resolve runtime DB/Vault blockers and delivery policy gates.
- [x] Add dependency-gated final runtime smoke plan.
- [ ] Deploy only after runtime blockers are closed.

## Goal 2: PDF And Durable Storage

Status: source-ready-runtime-gated

- [x] Choose PDF rendering library/runtime: PDFKit.
- [x] Choose external object storage/attachment contract: MinIO/S3 immutable
      PDF objects owned by invoices; direct Notifications attachments deferred.
- [x] Store immutable DB-backed PDF bytes, checksum, MIME type, and filename.
- [x] Deliver secure PDF download link through Notifications payloads.
- [x] Add source-level nullable DB object-reference fields for future
      off-database PDF storage.
- [ ] Implement runtime MinIO/S3 bucket provisioning, service credentials,
      retention policy, approved migration application, upload/presign client,
      and backfill/rollback plan after owner approval.

## Goal 3: Customer Account Access

Status: dependency-gated

- [ ] Integrate with Auth/customer account after Auth invoice-profile/address
      wallet APIs exist.
- [x] Provide source-level account-scoped invoice listing/download by Auth
      validated subject with normalized email fallback.
- [x] Prove Orders source contract can populate customer Auth subject in
      order snapshots for new orders (`orders-microservice` commit `c4f1332`).
- [ ] Prove deployed Orders plus authenticated channel create callers pass Auth
      subject into new order snapshots.

## Goal 4: Corrections And Credit Notes

Status: blocked

- [ ] Owner-approved refund/correction workflow.
- [ ] Credit note numbering and linkage.
