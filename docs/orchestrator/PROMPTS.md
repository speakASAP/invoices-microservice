# Invoices Worker Prompts

## Workstream A: Service Core

Implement a buildable invoices-microservice MVP. Own only
`invoices-microservice/**`. Do not edit Orders, Payments, Notifications, or
Logging. Add invoice persistence, Orders event validation, idempotent issuance,
HTML rendering, tokenized document access, and source validation. Mark missing
runtime facts as `[MISSING: ...]`.

## Workstream B: Orders Internal Read Role

Add an internal service actor/read role for `invoices-microservice` so it can
read full order snapshots needed for invoice generation. Do not touch dirty
event contract files or expand Orders event payload with customer/billing data.

## Workstream D: PDF And Delivery

PDF generation is source-implemented with PDFKit and DB-backed immutable bytes.
The selected future storage contract is MinIO/S3-backed immutable PDF objects
owned by invoices with tokenized or presigned access. Direct Notifications
attachments are deferred until a concrete delivery requirement and provider
contract exist. Do not create buckets, write Vault values, change MinIO policy,
or send real notifications without explicit runtime approval.
