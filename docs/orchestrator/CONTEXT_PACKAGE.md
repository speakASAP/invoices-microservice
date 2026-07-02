# Context Package: Goal 1 Invoices Issuance MVP

## Included Context

- Owner request: generate proforma invoices on order creation and final tax
  invoices on payment completion.
- Orders contract: `orders.order.created.v1` and `orders.order.paid.v1` on
  RabbitMQ exchange `orders.events`.
- Payments contract: HTTP payment status bridge to Orders; no payment event bus.
- Notifications contract: HTTP `/notifications/send` with inline message and
  optional template data.
- Logging contract: HTTP `POST /api/logs`.
- Auth customer-data-wallet plan: Auth invoice profiles are planned, not
  implemented.

## Excluded Context

- No live provider payloads.
- No production order/customer rows.
- No secrets, token values, decoded JWTs, or provider credentials.
- No real notification send.

## Key Decisions

- Do not add customer/billing data to Orders events.
- Use Orders events as triggers, then fetch full order snapshots through an
  approved internal Orders API.
- Keep invoice issuance outside Payments.
- Fail closed into blocked invoice records when legal data/config is missing.
