# Business: invoices-microservice
>
> IMMUTABLE BY AI unless the owner explicitly updates invoice policy.

## Goal

Every order must have two invoice documents:

- proforma invoice generated when the order is created;
- final tax invoice generated when the order is paid.

Customers must be able to receive or download the generated documents.

## Constraints

- Do not create real invoices without required legal seller and buyer data.
- Do not duplicate invoice numbers.
- Do not generate a second invoice of the same type for the same order.
- Do not log customer addresses, payment provider details, tokens, or secrets.
- Refunds, credit notes, and corrections are separate owner-approved workflows.
