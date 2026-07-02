# Invoices Pre-Coding Gate

Gate status: pass-with-exception for source scaffold.

Exceptions:

- `[MISSING: production DB secret and database provisioning for invoices]`
- `[MISSING: runtime projection and verification of ORDERS_SERVICE_TOKEN for invoices-microservice reads]`
- `[MISSING: seller legal identity and VAT configuration]`
- `[MISSING: Notifications service token/channel policy for invoice delivery through channelKey invoices.documents]`
- `[MISSING: external object-storage/attachment contract for PDF tax documents]`
- `[MISSING: Orders/Auth producer proof that new order snapshots populate a stable customer Auth subject]`

Coding may proceed for source-only MVP because the implementation fails closed
when runtime/legal data is missing and deployment remains blocked.
