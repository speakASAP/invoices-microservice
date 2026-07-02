# Invoices Implementation State

```yaml
id: INVOICES-IMPLEMENTATION-STATE
status: active
owner: Invoices owner
created: 2026-07-02
last_updated: 2026-07-02
completeness_level: source-scaffold
current_goal: Goal 1 Invoices Issuance MVP
current_chunk: Initial service scaffold and contract plan
blockers:
  - [MISSING: production DB secret and database provisioning for invoices]
  - [MISSING: Orders internal service token and Orders allowlist entry for invoices-microservice reads]
  - [MISSING: seller legal identity and VAT configuration]
  - [MISSING: Notifications service token/channel policy for invoice delivery]
  - [MISSING: PDF attachment/storage contract]
```

## Current Checkpoint

2026-07-02: Initial implementation creates the invoices bounded context,
event-driven trigger contract, database model, annual invoice sequences, HTML
document rendering, opaque download-token access, and optional client stubs for
Orders, Payments, Notifications, and Logging. The service is source-ready but
not production-ready until runtime secrets, DB provisioning, seller legal
configuration, Orders service-role access, and delivery/storage policy are
resolved.

Validation passed on 2026-07-02: `npm run build`, `npm test`, `npm run
verify:contracts`, `git diff --check`, and client-side Kubernetes dry-run for
all manifests. Server-side dry-run passed for ConfigMap, Deployment, Service,
and Ingress; ExternalSecret server validation is blocked by
`[MISSING: external-secrets-webhook endpoints available for server-side validation]`.

2026-07-02 continuation: Added runtime readiness hardening for first deploy.
The database bootstrap path is now explicit and opt-in through
`DB_AUTO_CREATE=true`; production config keeps it disabled by default until the
database is either pre-provisioned or owner-approved for first deploy creation.
`npm run verify:runtime-readiness` validates DB bootstrap gating, consumer
fail-closed config, ExternalSecret API version, and secret projection.
Validation passed: `npm run build`, `npm test`, `npm run verify:contracts`,
`npm run verify:runtime-readiness`, and `git diff --check`. Server-side
Kubernetes dry-run still has the platform blocker
`[MISSING: external-secrets-webhook endpoints available for server-side validation]`.

## Preserved Intent

Orders remains canonical order truth and event producer. Payments remains
payment identity/reconciliation truth. Invoices owns issuance records, invoice
numbering, immutable invoice snapshots, document rendering, and delivery
attempt state.
