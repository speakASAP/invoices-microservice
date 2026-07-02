# System: invoices-microservice

## Stack

NestJS, TypeORM, PostgreSQL, RabbitMQ.

Port: `3204`.

## Dependencies

| Service | Purpose |
| --- | --- |
| Orders | Order and billing snapshot read; `orders.events` lifecycle triggers |
| Payments | Optional payment status snapshot enrichment |
| Notifications | Optional document delivery |
| Logging | Centralized operational logs |
| Auth | Future customer-account document access |

## Events

Consumes RabbitMQ exchange `orders.events`:

- `orders.order.created.v1`
- `orders.order.paid.v1`

## Numbering

Separate annual sequences:

- `PF-YYYY-NNNNNN` for proforma invoices;
- `INV-YYYY-NNNNNN` for final tax invoices.

Sequence allocation happens inside a database transaction and is unique by
invoice type and year.
