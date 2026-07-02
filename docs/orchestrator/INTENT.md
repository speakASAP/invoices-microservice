# Invoices Intent

`invoices-microservice` guarantees that each eligible order has:

- one proforma invoice when the order is created;
- one final tax invoice when the order is paid.

The service consumes safe lifecycle triggers from Orders, retrieves authorized
order snapshots for legal content, allocates invoice numbers, renders documents,
records idempotency evidence, and coordinates delivery.

## Ownership

Owned here:

- invoice issuance state;
- proforma and final invoice numbering;
- immutable invoice snapshots;
- rendered invoice document HTML and future PDF object references;
- document download token hashes;
- delivery attempt metadata.

Not owned here:

- order lifecycle and order mutation;
- payment creation, provider reconciliation, refunds, payouts, and payment
  status truth;
- customer reusable profile/address/invoice-profile truth;
- notification transport infrastructure;
- centralized log storage.
