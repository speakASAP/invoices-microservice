# System: invoices-microservice

```yaml
id: SYSTEM-invoices-microservice
status: approved
owner: project owner
created: 2026-07-02
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - BUSINESS.md
  - docs/01_vision/VISION.md
downstream:
  - docs/06_architecture/INTEGRATION_CONTRACT.md
  - docs/11_tasks/TASK-001-bootstrap-service.md
```

## purpose

invoices-microservice is the invoice issuance boundary for the Alfares e-commerce backbone. It turns Orders lifecycle events into exactly one proforma invoice and exactly one final tax invoice per order, owns invoice numbering, renders the invoice documents, and exposes guarded document read and download-link surfaces.

## responsibilities

- Consume `orders.order.created.v1` and `orders.order.paid.v1` and issue the matching invoice type
- Own invoice numbering with separate annual sequences allocated inside a database transaction
- Enforce issuance idempotency on the Orders event `eventId` and on the durable `(orderId, invoiceType)` key
- Read the order and billing snapshot from `orders-microservice` for invoice content
- Optionally enrich the invoice with a payment status snapshot from `payments-microservice`
- Render invoice documents as HTML and PDF and expose guarded document reads and opaque customer download tokens
- Optionally request document delivery from `notifications-microservice`
- Emit sanitized structured logs to `logging-microservice` and expose `GET /health`

## non-responsibilities

- It is not the source of truth for orders, order items or order lifecycle state
- It does not process payments, reconcile providers or execute refunds
- It does not own notification channels, templates or delivery infrastructure
- It does not own customer identity or profile data
- It does not perform refunds, credit notes or invoice corrections

## inputs

- RabbitMQ Orders lifecycle events `orders.order.created.v1` and `orders.order.paid.v1` from the `orders.events` exchange
- Synthetic Orders event ingestion for validation and replay via the internally guarded `POST /invoices/events/orders`
- Order and billing snapshots read over HTTP from `orders-microservice` at `GET /api/orders/:orderId`
- Optional payment status snapshots read from `payments-microservice`
- Seller legal and tax identity configuration supplied through the `INVOICE_SELLER_*` environment values

## outputs

- Durable invoice document, invoice sequence counter and invoice event records in the service's own PostgreSQL database
- Allocated invoice numbers from the proforma and final tax invoice annual sequences
- Rendered invoice HTML and PDF documents served through guarded internal routes and opaque customer download tokens
- Optional invoice-ready delivery requests sent to `notifications-microservice`
- Sanitized structured logs sent to `logging-microservice`

## dependencies

| Service | Purpose |
| --- | --- |
| Orders | Order and billing snapshot read; `orders.events` lifecycle triggers |
| Payments | Optional payment status snapshot enrichment |
| Notifications | Optional document delivery |
| Logging | Centralized operational logs |
| Auth | Customer-account document access through the customer auth guard |

Runtime platform dependencies: PostgreSQL (own `invoices` database, TypeORM migrations run at startup) and RabbitMQ (`orders.events` topic exchange, queue `invoices.orders.lifecycle`).

## upstream traceability

This system implements the approved issuance intent in `BUSINESS.md` and the product direction in `docs/01_vision/VISION.md`. It preserves the one-proforma/one-final-invoice rule, the no-duplicate-numbering rule and the prohibition on issuing invoices without complete legal data.

## downstream artifacts

- `docs/06_architecture/INTEGRATION_CONTRACT.md`
- `docs/11_tasks/TASK-001-bootstrap-service.md`
- `docs/21_execution_plans/EP-TASK-001-bootstrap-service.md`
- `docs/12_validation/VAL-TASK-001-bootstrap-service.md`

## validation criteria

- `GET /health` returns a healthy service payload
- A repeated Orders event for the same order and invoice type never produces a second invoice record
- Invoice numbers are unique within each invoice type and year
- No customer address, provider payload, token or secret appears in emitted log metadata

## open questions

- Durable object-storage rollout for rendered invoice documents is not yet authorized. Documents are currently persisted in the service database and rendered on demand; a MinIO/S3 rollout would require owner approval, bucket provisioning, credentials, a retention policy, the object-reference migration and a backfill plan.
- Deployed authenticated checkout proof that new Orders snapshots persist `customer.authSubject` across all active sales channels is not yet available, which gates full customer-account invoice lookup coverage.
- A refund, credit-note and correction workflow, including its numbering and linkage policy, has not yet been approved by the owner and is therefore intentionally absent from this service.

## runtime and operations detail

**Stack**: NestJS, TypeORM, PostgreSQL, RabbitMQ, PDFKit
**Port**: `3204`
**Platform**: Kubernetes (k3s) · namespace `statex-apps` · domain `https://invoices.alfares.cz`
**Deploy**: `./scripts/deploy.sh`

### events consumed

Consumes the RabbitMQ topic exchange `orders.events` through the durable queue `invoices.orders.lifecycle`:

- `orders.order.created.v1`
- `orders.order.paid.v1`

The consumer is implemented in `src/events/rabbitmq-orders.consumer.ts` and is activated by `ORDERS_EVENTS_CONSUMER_ENABLED=true`. The production ConfigMap currently sets it to `false`, so issuance is presently driven through the guarded synthetic ingestion route while the owner-gated runtime activation remains pending.

### numbering

Separate annual sequences:

- `PF-<year>-<sequence>` for proforma invoices;
- `INV-<year>-<sequence>` for final tax invoices.

Sequence allocation happens inside a database transaction and is unique by invoice type and year.

### secrets

Secrets are stored in Vault at `secret/prod/invoices-microservice` and `secret/prod/invoices-microservice-seller` and synced into `statex-apps` by External Secrets Operator.

For machine service identity, follow the sole canonical [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md). It is not reproduced here.

### current state

Stage: production · Health: ok
