# Invoices Orchestrator Status

## 2026-07-02 - Initial Service Scaffold

Created the source plan for a standalone invoices service. Key decisions:

- proforma trigger: `orders.order.created.v1`;
- final invoice trigger: `orders.order.paid.v1`;
- Orders events remain trigger-only and must not gain customer/billing fields;
- service fetches full Orders snapshot through an internal read role;
- missing legal/runtime data creates blocked invoice records instead of fake
  invoices;
- deployment is blocked until DB, secrets, seller legal config, Orders role, and
  delivery/storage contracts are resolved.

Validation:

- `npm run build`: passed.
- `npm test`: passed, 2 suites / 4 tests.
- `npm run verify:contracts`: passed.
- `git diff --check`: passed.
- `kubectl apply --dry-run=client -f k8s/configmap.yaml -f k8s/external-secret.yaml -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/ingress.yaml -n statex-apps`: passed.
- Server-side dry-run passed for ConfigMap, Deployment, Service, and Ingress,
  but ExternalSecret admission was blocked by platform state:
  `[MISSING: external-secrets-webhook endpoints available for server-side validation]`.

Next action: provision DB/Vault/runtime configuration and resolve Orders token
projection before enabling the RabbitMQ consumer or deploying.

## 2026-07-02 - Runtime Readiness Hardening

Added an explicit database bootstrap gate. `DB_AUTO_CREATE=true` can create the
configured database through the admin database only when that runtime flag is
set; production manifests keep `DB_AUTO_CREATE=false` by default. Database names
are restricted to letters, numbers, and underscores before any create statement
can be built.

Added `npm run verify:runtime-readiness` to assert:

- DB auto-create remains opt-in;
- production config keeps DB auto-create disabled by default;
- the RabbitMQ Orders consumer remains disabled until runtime blockers close;
- the ExternalSecret uses the live `external-secrets.io/v1` API;
- the deployment projects the invoices runtime secret.

Validation:

- `npm run build`: passed.
- `npm test`: passed, 3 suites / 6 tests.
- `npm run verify:contracts`: passed.
- `npm run verify:runtime-readiness`: passed.
- `git diff --check`: passed.
- Server-side Kubernetes dry-run still passes for ConfigMap, Deployment,
  Service, and Ingress, but ExternalSecret admission remains blocked because
  `external-secrets-webhook` has no endpoints while the cluster is still
  recreating core pods after a k3s/node restart.
