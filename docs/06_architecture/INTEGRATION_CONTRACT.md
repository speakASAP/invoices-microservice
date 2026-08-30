# Integration Contract

```yaml
id: INTEGRATION-CONTRACT-invoices-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - ../../SYSTEM.md
  - ../../BUSINESS.md
downstream:
  - ../11_tasks/TASK-001-bootstrap-service.md
  - ../12_validation/VAL-TASK-001-bootstrap-service.md
```

## purpose

This contract records how invoices-microservice participates in the Alfares ecosystem: which capabilities are required, which are intentionally not applicable, and what happens when a required dependency is unavailable. The service is the invoice issuance boundary; it reads order and payment truth from their owning services and never becomes the source of truth for orders, payments, delivery or identity.

## capability decisions

The machine-readable decisions live in `ips-adoption.json`. This document adds the human-readable architecture and contract links. Every decision below was verified against the repository source, not inferred from environment variable names alone.

| Capability | Component | Decision | Contract/API/event | Configuration | Failure mode | Validation evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Auth | `auth-microservice` | required | Customer bearer tokens validated by `POST /auth/validate` for customer-account invoice routes | `AUTH_SERVICE_URL` in `k8s/configmap.yaml` | Customer-account routes reject the request (401/403); guarded internal and token-based document routes are unaffected | `src/common/customer-auth.guard.ts`, `@UseGuards(CustomerAuthGuard)` on `/invoices/account` routes |
| PostgreSQL | `db-server-postgres` | required | Own `invoices` database holding invoice documents, sequence counters and event records | `DB_HOST=db-server-postgres`, `DB_NAME=invoices`, `DB_MIGRATIONS_RUN=true`, `DB_PASSWORD` from Vault | Issuance fails closed; no invoice is recorded or numbered without durable persistence | `src/database.module.ts`, `src/invoices/entities/*.entity.ts`, `src/migrations/20260702120000-CreateInvoicesTables.ts` |
| Redis | `db-server-redis` | not-applicable | No Redis client or dependency exists in the codebase | not-applicable | not-applicable | No `redis` match in `src/` or `package.json` dependencies |
| Logging | `logging-microservice` | required | Sanitized structured log payloads POSTed to `LOGGING_SERVICE_URL` | `LOGGING_SERVICE_URL`, `LOGGING_SERVICE_API_PATH` | Log delivery failure degrades observability but never blocks issuance | `src/common/logger.service.ts` with its sensitive-key redaction pattern |
| Notifications | `notifications-microservice` | required | `POST /notifications/send` invoice-ready delivery with a document download link | `NOTIFICATIONS_SERVICE_URL`, `NOTIFICATIONS_SERVICE_TOKEN`, `INVOICES_NOTIFICATION_CHANNEL_KEY` | Delivery returns false and is logged; the invoice remains issued and downloadable | `src/invoices/notifications-client.service.ts` |
| AI | `ai-microservice` | not-applicable | No AI client, model call or prompt path exists in the codebase | not-applicable | not-applicable | No `ai-microservice` or AI client match in `src/` or `package.json` |
| Payments | `payments-microservice` | required | `GET /payments/status/by-order-id` read for optional payment snapshot enrichment of the final tax invoice | `PAYMENTS_SERVICE_URL`, `PAYMENTS_API_KEY` (sent as `X-API-Key`) | Snapshot read returns null and is logged; the final tax invoice is still issued without enrichment | `src/invoices/payments-client.service.ts` |
| Catalog | `catalog-microservice` | not-applicable | Invoice line items come from the Orders billing snapshot, not from catalog reads | not-applicable | not-applicable | No catalog client or `CATALOG_SERVICE_URL` in `src/` or `.env.example` |
| Orders | `orders-microservice` | required | Authenticated `GET /api/orders/:orderId` snapshot read plus consumption of `orders.order.created.v1` and `orders.order.paid.v1` | `ORDERS_SERVICE_URL`, `ORDERS_SERVICE_TOKEN` sent as `x-internal-service-token` | The snapshot read raises `ORDER_READ_CONFIG_MISSING` or a read failure and issuance is blocked rather than inventing order data | `src/invoices/orders-client.service.ts`, `src/events/rabbitmq-orders.consumer.ts` |
| Warehouse | `warehouse-microservice` | not-applicable | Invoice issuance has no stock, reservation or fulfillment dependency | not-applicable | not-applicable | No warehouse client or `WAREHOUSE_SERVICE_URL` in `src/` or `.env.example` |
| Invoices | `invoices-microservice` | not-applicable | This service is the invoices domain itself | not-applicable | not-applicable | Self-referential capability |
| Object storage | `minio-microservice` | not-applicable | Rendered documents are persisted in the service database and rendered on demand with PDFKit; no bucket client exists | not-applicable | not-applicable | No `minio`/`s3` match in `src/`, `package.json` or `k8s/`; durable object storage remains an owner-gated future rollout |
| Events | RabbitMQ | required | Consumes `orders.order.created.v1` and `orders.order.paid.v1` from the `orders.events` topic exchange through the durable queue `invoices.orders.lifecycle` | `RABBITMQ_URL`, `ORDERS_EVENTS_EXCHANGE`, `INVOICES_ORDERS_QUEUE`, `ORDERS_EVENTS_CONSUMER_ENABLED` (currently `false` in the production ConfigMap) | Consumer connection failure is logged and messages are nacked without requeue; issuance can still be driven through the guarded synthetic ingestion route | `src/events/rabbitmq-orders.consumer.ts`, `amqplib` dependency in `package.json` |
| Documentation retrieval | `docs-rag-microservice` | required | Direct Git repository ingestion | Repository catalog registration | Git remains authoritative when RAG is degraded | Retrieval source check against the owning repository path |
| Monitoring | `monitoring-microservice` | required | `GET /health` with the Kubernetes readiness probe | Probes defined in `k8s/deployment.yaml` | Readiness failure blocks rollout completion | `src/health.controller.ts` |
| Backups | `backups-microservice` | required | PostgreSQL backup and retention policy for durable invoice, numbering and event records | Retention and backup schedule managed by `database-server` for the `invoices` database | Loss of issuance or numbering history is surfaced and triaged before continued operation | Backup posture defined and reviewed at the database-server level |

## data ownership

invoices-microservice owns invoice document records, invoice sequence counters, invoice event records, download tokens and delivery attempts. Order and order-item truth remains with `orders-microservice`; payment truth remains with `payments-microservice`; delivery channels remain with `notifications-microservice`; customer identity remains with `auth-microservice`. Order and payment data stored on an invoice is a point-in-time snapshot, not a source of truth.

## authentication and authorization

- Internal routes (`/invoices/order/:orderId`, `/invoices/events/orders`, `/invoices/:invoiceId/document.*`, `/invoices/:invoiceId/download-link`) are guarded by `InternalAuthGuard`, which compares the presented token against `INVOICES_INTERNAL_SERVICE_TOKEN` with a constant-time comparison.
- Customer-account routes (`/invoices/account`, `/invoices/account/:invoiceId/download-link`) are guarded by `CustomerAuthGuard`, which validates the customer bearer token against `auth-microservice`.
- Public document routes (`/documents/:invoiceId.html`, `/documents/:invoiceId.pdf`) require an opaque, rotatable download token rather than a session.
- Outbound calls authenticate with `ORDERS_SERVICE_TOKEN`, `PAYMENTS_API_KEY` and `NOTIFICATIONS_SERVICE_TOKEN`, all delivered from Vault through External Secrets Operator.

## synchronous dependencies

- PostgreSQL reads and writes for invoice records, sequence allocation and event idempotency.
- `orders-microservice` order and billing snapshot reads during issuance.
- `payments-microservice` payment status snapshot reads for optional final tax invoice enrichment.
- `auth-microservice` token validation for customer-account invoice access.
- `notifications-microservice` invoice-ready delivery requests.

## asynchronous dependencies

- Consumption of `orders.order.created.v1` and `orders.order.paid.v1` from the RabbitMQ `orders.events` topic exchange via the durable queue `invoices.orders.lifecycle`. The consumer code is implemented and bound to both routing keys; the production ConfigMap currently sets `ORDERS_EVENTS_CONSUMER_ENABLED=false`, so runtime activation remains an owner-gated switch rather than a code gap.
- invoices-microservice publishes no events of its own.

## degraded operation

When `payments-microservice` or `notifications-microservice` is unavailable, the affected enrichment or delivery is skipped, logged in sanitized form, and the invoice remains issued and downloadable. When `orders-microservice` or PostgreSQL is unavailable, issuance fails closed and no partial or unnumbered invoice is created. When RabbitMQ is unavailable or the consumer is disabled, lifecycle-driven issuance pauses and can be replayed later through the guarded synthetic ingestion route, protected by the `(orderId, invoiceType)` idempotency key. When `auth-microservice` is unavailable, customer-account access is rejected while token-based document downloads continue to work.

## validation

- `GET /health` returns a healthy payload.
- A replayed Orders event never produces a second invoice of the same type for the same order.
- Invoice numbers are unique within each invoice type and year, allocated inside a database transaction.
- Internal routes reject a request without a valid internal service token; customer-account routes reject a request without a valid customer bearer token.
- Emitted log metadata contains no address, email, token or provider payload values.
