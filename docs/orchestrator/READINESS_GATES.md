# Invoices Readiness Gates

## Source Readiness

- `npm run build`
- `npm test`
- `npm run verify:contracts`
- `git diff --check`

## Runtime Readiness

- DB and Vault secrets exist without printing values.
- Orders accepts `invoices-microservice` internal read role.
- Seller legal fields are configured.
- RabbitMQ queue binding is configured.
- Notifications delivery policy is configured or explicitly disabled.
- Public document base URL is configured.

## Deployment Readiness

Deployment is blocked until runtime readiness is complete.
