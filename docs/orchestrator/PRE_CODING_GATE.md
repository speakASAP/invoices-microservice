# Invoices Pre-Coding Gate

Gate status: pass-with-exception for source scaffold.

Exceptions:

- `[MISSING: production DB secret and database provisioning for invoices]`
- `[MISSING: Orders internal service token and Orders allowlist entry for invoices-microservice reads]`
- `[MISSING: seller legal identity and VAT configuration]`
- `[MISSING: Notifications service token/channel policy for invoice delivery]`
- `[MISSING: PDF attachment/storage contract]`

Coding may proceed for source-only MVP because the implementation fails closed
when runtime/legal data is missing and deployment remains blocked.
