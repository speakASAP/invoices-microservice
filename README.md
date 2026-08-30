# invoices-microservice

Statex invoice issuance boundary for proforma invoices and final tax invoices.

## status

invoices-microservice is a production runtime service in the Alfares ecosystem. The Goal 1 issuance MVP is runtime-complete and the repository is aligned to the IPS adoption standard. Remaining work is owner-gated (durable document storage, corrections workflow) or dependency-gated (authenticated Orders snapshot proof).

## documentation authority

Git and the approved upstream intent documents are the source of truth. The effective authority chain is:

- `BUSINESS.md` for invoice issuance intent and constraints
- `docs/01_vision/VISION.md` for the target outcome
- `SYSTEM.md` for service responsibilities and dependencies
- `docs/17_governance/PROJECT_INVARIANTS.md` for guardrails
- `docs/06_architecture/INTEGRATION_CONTRACT.md` for ecosystem integration decisions
- `docs/IMPLEMENTATION_ORCHESTRATOR.md` and `docs/orchestrator/*` for the pre-existing implementation-orchestrator execution discipline

## capabilities

- Exactly one proforma invoice per order, issued on `orders.order.created.v1`
- Exactly one final tax invoice per order, issued on `orders.order.paid.v1`
- Durable invoice numbering from separate annual sequences allocated inside a database transaction
- Idempotent event handling keyed on the Orders event identifier and on `(orderId, invoiceType)`
- HTML and PDF invoice document rendering with guarded internal reads and opaque customer download tokens
- Optional invoice-ready delivery through `notifications-microservice`

## interfaces

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Public health check |
| `GET` | `/invoices/order/:orderId` | Internal read of invoice records for an order |
| `POST` | `/invoices/events/orders` | Internal synthetic Orders-event ingestion for validation and replay |
| `GET` | `/invoices/account` | Customer-authenticated list of the caller's own invoices |
| `POST` | `/invoices/account/:invoiceId/download-link` | Customer-authenticated download-link rotation |
| `GET` | `/invoices/:invoiceId/document.html` | Internal guarded document HTML read |
| `GET` | `/invoices/:invoiceId/document.pdf` | Internal guarded document PDF read |
| `POST` | `/invoices/:invoiceId/download-link` | Internal guarded public download-link rotation |
| `GET` | `/documents/:invoiceId.html` | Customer document download by opaque token |
| `GET` | `/documents/:invoiceId.pdf` | Customer PDF download by opaque token |

The service also consumes the RabbitMQ `orders.events` exchange and persists its own state in PostgreSQL.

## development

- Stack: NestJS, TypeScript, TypeORM, PostgreSQL, RabbitMQ, PDFKit
- Local service entry: `npm run start:dev` (see `package.json` scripts)
- Build entry: `npm run build`
- Test entry: `npm test`
- Keep edits compatible with the issuance idempotency keys and the transactional numbering allocation

## configuration

- Runtime namespace: `statex-apps`
- Domain: `https://invoices.alfares.cz`
- Service port: `3204`
- Environment values are managed through `.env.example`, the `invoices-microservice-config` ConfigMap and the Vault/ESO secret flow (`secret/prod/invoices-microservice` and `secret/prod/invoices-microservice-seller`); secrets are never committed to Git
- The Orders event consumer is gated by `ORDERS_EVENTS_CONSUMER_ENABLED`, currently `false` in the production ConfigMap

## deployment

- Deploy command: `./scripts/deploy.sh`
- Declarative deploy contract: `deploy.config.sh`
- Target: Kubernetes (k3s) in `statex-apps`
- Health requirement: `GET /health` passes before rollout completion
- Deployment remains serialized via the shared deployment lock and rollout gate

## health and observability

- Health endpoint: `GET /health` (`src/health.controller.ts`)
- Sanitized structured logging via `logging-microservice` (`src/common/logger.service.ts` redacts tokens, addresses, emails and provider payloads)
- Monitoring via `monitoring-microservice` and the Kubernetes readiness probe
- Operator checks: `kubectl logs -n statex-apps -l app=invoices-microservice -f`

## flow

1. Orders emits `orders.order.created.v1`.
2. Invoices creates exactly one proforma invoice record for the order.
3. Payments confirms payment to Orders.
4. Orders emits `orders.order.paid.v1`.
5. Invoices creates exactly one final tax invoice record for the order.
6. Invoices optionally asks Notifications to deliver a link to the generated document.

## known runtime gates

- Owner-approved durable MinIO/S3 document storage rollout, object-reference migration application and backfill plan is not yet authorized; rendered documents currently live in the service database.
- Deployed authenticated checkout proof that new Orders snapshots persist `customer.authSubject` across all active channels is still outstanding.
- The refund, credit-note and correction workflow and its numbering/linkage policy still await owner approval.
