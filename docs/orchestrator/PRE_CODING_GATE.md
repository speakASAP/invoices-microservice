# Invoices Pre-Coding Gate

Gate status: pass-with-exception for source scaffold.

Exceptions:

- `[MISSING: production DB secret and database provisioning for invoices]`
- `[MISSING: runtime projection and verification of ORDERS_SERVICE_TOKEN for invoices-microservice reads]`
- `[MISSING: seller legal identity and VAT configuration]`
- `[MISSING: Notifications service token/channel policy for invoice delivery through channelKey invoices.documents]`
- `[MISSING: runtime MinIO/S3 bucket, credentials, retention policy, DB object-reference migration, upload/presign client, and backfill plan for off-database PDF tax documents]`
- `[MISSING: FlipFlop runtime smoke proving authenticated central order snapshots carry customer.authSubject]`
- `[MISSING: Cliplot hosted Auth callback/session contract before authenticated checkout can pass Auth subject]`

Coding may proceed for source-only MVP because the implementation fails closed
when runtime/legal data is missing and deployment remains blocked.
