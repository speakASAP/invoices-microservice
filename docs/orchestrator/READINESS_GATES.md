# Invoices Readiness Gates

## Source Readiness

- `npm run build`
- `npm test`
- `npm run verify:contracts`
- `npm run verify:runtime-readiness`
- `git diff --check`

## Runtime Readiness

- DB and Vault secrets exist without printing values.
- `DB_AUTO_CREATE` is either explicitly owner-approved for first deploy or the
  `invoices` database already exists.
- Orders accepts `invoices-microservice` internal read role.
- Seller legal fields are configured.
- RabbitMQ queue binding is configured.
- Notifications delivery policy is configured or explicitly disabled.
- Public document base URL is configured.

## Deployment Readiness

Deployment is blocked until runtime readiness is complete.
