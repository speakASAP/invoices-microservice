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
- Payments accepts the invoices API key with `payments:read` scope.
- Seller legal fields are configured before legal issuance; missing seller
  legal data must fail closed and must not block service startup.
- RabbitMQ queue binding is configured.
- Notifications delivery policy is configured or explicitly disabled.
- Public document base URL is configured.
- PDF documents are generated and retrievable through guarded internal and tokenized public endpoints.

## Deployment Readiness

Deployment is blocked until runtime readiness is complete.
