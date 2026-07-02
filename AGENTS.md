# Repository Agent Instructions

Shared rules live here:

- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`

## invoices-microservice

Work in this remote repository only:

```bash
ssh alfares
cd /home/ssf/Documents/Github/invoices-microservice
```

Do not save project code under `/Users/Sergej.Stasok/Documents`.

## Preserved Boundary

`invoices-microservice` owns invoice issuance records, invoice numbering,
document rendering, invoice download links, and delivery attempts.

Orders owns order records, order item snapshots, lifecycle state, and
`orders.events`. Payments owns payment identity, provider reconciliation,
refunds, and status. Notifications owns outbound delivery. Logging owns log
storage. Auth owns reusable identity/profile data. Do not move those domains
into invoices.

## Intent Preservation System

Before coding, preserve:

Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation

Use the compact IPS pack in `docs/orchestrator/*`,
`docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/IMPLEMENTATION_STATE.md`, and
`implementation-goals/README.md`.

## Current Product Contract

- Generate one proforma invoice on `orders.order.created.v1`.
- Generate one final tax invoice on `orders.order.paid.v1`.
- Treat each Orders event `eventId` as idempotency input.
- Treat `(orderId, invoiceType)` as the durable issuance idempotency key.
- Never invent seller, buyer, VAT, payment, or address fields. If required
  legal data is missing, create/update a blocked invoice record and log a
  sanitized blocker.
- Do not print raw customer addresses, tokens, provider payloads, or secrets.

## Response Contract

End every assistant response with a final line beginning `Next step:`.
