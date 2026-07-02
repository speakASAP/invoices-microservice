# Runtime Activation Plan: Invoices Microservice

Status: approval-gated.
Owner lane: platform/runtime integration.
Repository: `/home/ssf/Documents/Github/invoices-microservice`.
Prepared: 2026-07-02.

This plan is intentionally non-mutating. It defines the exact work needed to
move the source-ready invoices service into deployed runtime without printing
or inventing secret values. Do not create databases, write Vault values, change
Payments keys, enable RabbitMQ consumption, or send notifications from this
lane until the owner approves the specific runtime action.

## Intent Preservation Chain

- Vision: every eligible order has one proforma invoice on order creation and
  one final tax invoice on payment completion.
- Goal Impact: close runtime prerequisites without moving order, payment,
  notification, logging, auth, or seller-legal ownership into Invoices.
- System: Invoices consumes Orders triggers, fetches Orders/Payments snapshots,
  renders immutable documents, delivers links through Notifications, and emits
  sanitized logs to Logging.
- Feature: runtime activation gate for DB, Vault, service identity, delivery,
  seller legal data, deploy switch, and final smoke.
- Task: provide owner-ready workstreams, allowed/forbidden actions, validation
  commands, blockers, and merge/deploy order.
- Execution Plan: keep source checks green, close runtime gates in parallel,
  deploy only after `verify:runtime-prereqs`, then run final smoke only after
  `verify:final-smoke-prereqs`.
- Coding Prompt: source-only edits are allowed here; live runtime mutation is
  approval-gated.
- Code: this runbook plus existing verifier scripts.
- Validation: commands listed under each lane.

## Current Gate State

Last observed on 2026-07-02:

- `npm run verify:runtime-prereqs`: fails closed on
  `[MISSING: Vault path secret/prod/invoices-microservice]` and
  `[MISSING: database invoices]`.
- Orders, Payments, Notifications, Logging, and RabbitMQ all report ready
  `1/1`.
- `npm run verify:final-smoke-prereqs`: fails closed because core runtime
  prerequisites fail and because final-smoke-only deploy/delivery/legal gates
  are not configured yet.

## Parallel Runtime Workstreams

| Lane | Status | Owner | Scope | Forbidden | Validation |
| --- | --- | --- | --- | --- | --- |
| A Vault core | approval-gated | platform/secrets owner | create `secret/prod/invoices-microservice` keys: `DB_PASSWORD`, `INVOICES_INTERNAL_SERVICE_TOKEN`, `ORDERS_SERVICE_TOKEN`, `PAYMENTS_API_KEY`, `NOTIFICATIONS_SERVICE_TOKEN` | printing secret values; placeholder values | `npm run verify:runtime-prereqs` key-presence checks |
| B Database | approval-gated | DB/platform owner | provision `invoices` database, or explicitly approve one first deploy with `DB_AUTO_CREATE=true` | implicit DB create; destructive DB operations | `npm run verify:runtime-prereqs` database check |
| C Payments key | dependency-gated | Payments owner | register the invoices `PAYMENTS_API_KEY` in Payments `API_KEYS` with `payments:read` scope | sharing raw keys in docs/logs | `npm run verify:final-smoke-prereqs` scope check |
| D Notifications delivery | dependency-gated | Notifications owner | project `INVOICES_NOTIFICATIONS_SERVICE_TOKEN`, configure active `invoices.documents` policy for `invoices-microservice` and `transactional` | real customer sends before approval | `npm run verify:final-smoke-prereqs`; Notifications no-send readiness |
| E Seller legal | approval-gated | legal/platform owner | create `invoices-microservice-seller-secret` with seller legal identity and tax/company identifier | fake legal identity | `npm run verify:final-smoke-prereqs` seller checks |
| F Deploy switch | dependency-gated | integration owner | deploy workload, set `INVOICES_PUBLIC_BASE_URL=https://invoices.alfares.cz`; enable `ORDERS_EVENTS_CONSUMER_ENABLED=true` only for final smoke | enabling consumer before DB/Vault pass | `npm run verify:final-smoke-prereqs` deployment/config checks |
| G Final smoke | dependency-gated | validation owner | synthetic order, proforma invoice, paid event, final tax invoice, account download, logging evidence | real customer order/payment/notification | `docs/orchestrator/FINAL_RUNTIME_SMOKE_PLAN.md` |

## Activation Order

1. Keep source clean and green:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run build && npm test && npm run verify:contracts && npm run verify:runtime-readiness && git diff --check'
   ```

2. Close lanes A and B, then prove core deploy prerequisites:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:runtime-prereqs'
   ```

3. Deploy only after step 2 passes:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && ./scripts/deploy.sh'
   ```

4. Close lanes C, D, E, and F, then prove final smoke prerequisites:

   ```bash
   ssh alfares 'cd /home/ssf/Documents/Github/invoices-microservice && npm run verify:final-smoke-prereqs'
   ```

5. Execute final smoke with synthetic owner-approved fixture only after step 4
   passes. Capture evidence in `docs/orchestrator/STATUS.md` and
   `docs/IMPLEMENTATION_STATE.md`.

## Approval Boundaries

- Owner approval required: create `invoices` database, set Vault values, change
  Payments runtime API keys, write seller legal secrets, deploy the service, set
  `ORDERS_EVENTS_CONSUMER_ENABLED=true`, create fixture orders/payments, or send
  notifications.
- No approval required: read-only verifiers, source-only docs/tests/scripts,
  Kubernetes dry-runs, and non-secret status checks.

## Remaining Blockers

- `[MISSING: Vault path secret/prod/invoices-microservice]`
- `[MISSING: database invoices]`
- `[MISSING: Payments API key value registered in Payments API_KEYS with payments:read scope]`
- `[MISSING: Notifications channel_registry policy for invoices.documents]`
- `[MISSING: seller legal secret values for successful issuance]`
- `[MISSING: owner-approved invoices deploy and ORDERS_EVENTS_CONSUMER_ENABLED=true runtime switch]`
- `[MISSING: approved synthetic fixture order/customer/payment data]`
- `[MISSING: runtime proof that deployed Orders includes c4f1332 and authenticated channel create callers pass Auth subject into new order snapshots]`
- `[MISSING: external object-storage/attachment policy if PDF links are insufficient for the delivery channel]`
