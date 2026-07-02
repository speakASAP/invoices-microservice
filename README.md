# Invoices Microservice

Statex invoice issuance boundary for proforma invoices and final tax invoices.

## Flow

1. Orders emits `orders.order.created.v1`.
2. Invoices creates exactly one proforma invoice record for the order.
3. Payments confirms payment to Orders through `orders.payment-status.v1`.
4. Orders emits `orders.order.paid.v1`.
5. Invoices creates exactly one final tax invoice record for the order.
6. Invoices optionally asks Notifications to deliver a link to the generated
   document.

The service is event-driven through RabbitMQ exchange `orders.events` and keeps
its own database state for idempotency, numbering, documents, and delivery
attempts.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Public health check |
| `GET` | `/invoices/order/:orderId` | Internal read of invoice records for an order |
| `POST` | `/invoices/events/orders` | Internal synthetic Orders-event ingestion for validation/replay |
| `GET` | `/invoices/:invoiceId/document.html` | Internal guarded document HTML read |
| `POST` | `/invoices/:invoiceId/download-link` | Internal guarded public download-link rotation |
| `GET` | `/documents/:invoiceId.html?token=...` | Customer document download by opaque token |

## Runtime Blockers

- `[MISSING: production DB secret and database provisioning for invoices]`
- `[MISSING: Orders internal service token and Orders allowlist entry for invoices-microservice reads]`
- `[MISSING: seller legal identity and VAT configuration]`
- `[MISSING: Notifications service token/channel policy for invoice delivery]`
- `[MISSING: PDF attachment/storage contract]`

Until those are resolved, source can build and validate but production issuance
must stay gated.
