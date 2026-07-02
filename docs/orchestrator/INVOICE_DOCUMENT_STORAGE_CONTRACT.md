# Invoice Document Storage Contract

Status: source-selected-runtime-gated.
Owner lane: invoices/storage integration.
Prepared: 2026-07-02.

This document selects the off-database storage direction for invoice PDFs. It
does not authorize bucket creation, credential writes, retention-policy changes,
database migrations, customer sends, or production backfill.

## Intent Preservation Chain

- Vision: every eligible order has one proforma invoice at order creation and
  one final tax invoice at payment completion.
- Goal Impact: keep invoice documents immutable and retrievable without moving
  Orders, Payments, Notifications, Logging, Auth, or MinIO ownership into
  invoices.
- System: invoices renders legal documents, stores the canonical invoice
  record, writes or references immutable PDF bytes, exposes guarded document
  access, sends document links through Notifications, and logs sanitized
  operational events.
- Feature: future MinIO/S3-backed immutable PDF object storage for invoice
  documents.
- Task: define the storage contract, key layout, metadata, access model,
  retention rules, blockers, validation, and parallel implementation lanes.
- Execution Plan: keep the current DB-backed PDF baseline for first smoke,
  provision MinIO/S3 only after approval, migrate object references in a
  separate deployment, then backfill or dual-write under validation.
- Coding Prompt: source-only contract work is allowed now; runtime mutation is
  approval-gated.
- Code: this contract plus verifier assertions in
  `scripts/verify-invoice-contracts.js`.
- Validation: `npm run verify:contracts`, `npm run verify:runtime-readiness`,
  and future storage-specific runtime smoke after provisioning.

## Current Baseline

The current invoices source stores immutable HTML and PDF snapshots in the
`invoice_documents` table. The PDF fields are:

- `documentPdf`: rendered PDF bytes.
- `documentPdfSha256`: SHA-256 checksum for integrity checks.
- `documentMimeType`: currently `application/pdf`.
- `documentFilename`: stable customer-facing filename.

Download links are tokenized through invoices. Notifications receives a secure
PDF URL and can include the HTML URL as a secondary link. This baseline remains
the accepted first-smoke path until runtime storage is provisioned.

## Selected Off-Database Contract

Invoices will own invoice PDF object writes into a private MinIO/S3 bucket.
MinIO remains the storage platform owner; invoices does not own MinIO root
credentials, bucket admin APIs, or global storage policy.

Bucket:

- Runtime value: `[MISSING: invoice document bucket name]`.
- Access: private only; no anonymous or public bucket policy.
- Credential source: `[MISSING: service-scoped invoices S3 access key and secret in Vault]`.
- Required permissions: put object, get object, head object, and optional
  presign for the invoice bucket/prefix only.
- Forbidden permissions: bucket deletion, bucket policy mutation, credential
  issuance, and root/admin MinIO credentials.

Key layout:

```text
invoices/{yyyy}/{orderId}/{type}/{invoiceId}-{documentPdfSha256}.pdf
```

Where:

- `yyyy` is the invoice issue year.
- `orderId` is the central Orders UUID.
- `type` is `proforma` or `final`.
- `invoiceId` is the invoices document UUID.
- `documentPdfSha256` is the lowercase hex SHA-256 of the exact PDF bytes.

The key is deterministic for the immutable PDF bytes. If a document must be
corrected, create a future correction or credit-note document. Do not overwrite
an existing final tax invoice object.

Required object metadata:

| Metadata key | Source |
| --- | --- |
| `invoiceId` | `invoice_documents.id` |
| `orderId` | central Orders UUID |
| `invoiceType` | `proforma` or `final` |
| `invoiceNumber` | allocated invoice number |
| `documentPdfSha256` | checksum of uploaded PDF bytes |
| `mimeType` | `application/pdf` |
| `filename` | `documentFilename` |
| `issuedAt` | invoice issue timestamp |
| `retentionClass` | `[MISSING: legal retention class]` |

The database remains the canonical invoice index. Future storage migration must
add object reference fields, for example `documentObjectBucket`,
`documentObjectKey`, `documentObjectSha256`, `documentObjectEtag`,
`documentObjectSize`, and `documentStoredAt`, without removing DB-backed PDF
read capability until backfill is verified.

## Access Model

- Customer access remains through invoices-owned tokenized endpoints.
- Public bucket reads are forbidden.
- Presigned URLs may be minted only by invoices or a future approved storage
  wrapper for a bounded TTL.
- Internal service reads require `INVOICES_INTERNAL_SERVICE_TOKEN`.
- Customer account reads require Auth validation and subject/email scoping.
- Notifications receives links, not raw PDF bytes, for the current delivery
  path.

Direct email attachments are explicitly deferred. The current
`notifications-microservice` invoices contract validates `channelKey=
invoices.documents` link payloads. It does not prove an outbound raw MIME
attachment path for invoice PDFs through `/notifications/send`.

## Retention And Immutability

- Final tax invoice objects are immutable after issue.
- Proforma objects are immutable snapshots of the payment request at order
  creation time.
- Overwrite is forbidden when the object exists with a different checksum.
- Delete is forbidden without a separate owner-approved legal retention policy.
- Correction, cancellation, and credit-note flows are future documents, not
  mutation of existing final invoices.
- Retention policy is `[MISSING: legal retention policy for invoice PDFs]` and
  must be approved before object lifecycle automation is enabled.

## Logging And Audit

Logging must record only sanitized operational metadata:

- invoice id;
- order id;
- invoice type;
- object bucket/key prefix or hash when needed;
- checksum comparison result;
- storage operation outcome.

Logs must not include raw PDF bytes, presigned URL query strings, bearer
tokens, S3 access keys, customer emails, billing addresses, or full order
snapshots.

## Runtime Implementation Lanes

| Lane | Status | Owner | Scope | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- |
| A Bucket policy | approval-gated | MinIO/platform owner | private invoice bucket and prefix policy | root credential sharing; public bucket | MinIO policy check plus non-secret bucket head |
| B Secrets | approval-gated | platform/secrets owner | service-scoped S3 access key/secret in Vault | printing secret values | key-presence verifier without values |
| C DB migration | dependency-gated | invoices owner | object reference fields and fallback reads | dropping DB PDF before backfill | migration dry-run and invoice read tests |
| D Storage client | dependency-gated | invoices owner | put/head/get/presign wrapper with checksum verification | bucket admin APIs | focused storage unit tests |
| E Backfill/dual-write | dependency-gated | integration owner | write objects for new invoices and optionally backfill existing DB PDFs | destructive cleanup | synthetic runtime smoke and checksum audit |
| F Notifications attachment review | blocked | notifications owner | direct PDF attachments only if product/legal requires them | real sends before approval | no-send validation or provider sandbox |

## Open Blockers

- `[MISSING: invoice document bucket name]`
- `[MISSING: service-scoped invoices S3 credentials in Vault]`
- `[MISSING: approved retention class and lifecycle policy for tax documents]`
- `[MISSING: DB migration for invoice document object references]`
- `[MISSING: invoices storage client implementation and checksum validation]`
- `[MISSING: backfill and rollback plan for DB-backed PDFs]`
- `[MISSING: runtime smoke evidence for upload, head, tokenized download, and checksum match]`
- `[MISSING: direct Notifications attachment contract, only if links are insufficient]`

## Current Decision

Proceed with the DB-backed PDF baseline for first runtime smoke. Use this
contract as the implementation target for the later off-database storage lane.
Do not add S3 runtime dependencies, create buckets, write Vault values, or
change MinIO policy until the approval-gated storage lanes are explicitly
opened.
