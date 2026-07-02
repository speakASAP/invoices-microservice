# Invoices Implementation Orchestrator

```yaml
id: INVOICES-IMPLEMENTATION-ORCHESTRATOR
status: active
owner: Invoices owner
created: 2026-07-02
last_updated: 2026-07-02
completeness_level: initial
upstream:
  - AGENTS.md
  - BUSINESS.md
  - SYSTEM.md
downstream:
  - docs/IMPLEMENTATION_STATE.md
  - docs/orchestrator/STATUS.md
```

## Mission

Continue from repository state, not chat memory. Preserve the original intent:
every Statex order gets a proforma invoice on order creation and a final tax
invoice on payment completion, without moving Orders, Payments, Notifications,
Logging, or Auth ownership into this service.

## Session Algorithm

1. Read `AGENTS.md`, `BUSINESS.md`, `SYSTEM.md`, `docs/IMPLEMENTATION_STATE.md`,
   and `docs/orchestrator/*`.
2. Select the active goal from `docs/orchestrator/GOALS.md`.
3. Confirm boundary impact: Orders events trigger; Orders read API supplies
   order snapshots; Payments supplies optional payment snapshot; Notifications
   delivers; Logging records sanitized operations.
4. Keep shared cross-service contract files under one integration owner.
5. Before coding, update or verify `docs/orchestrator/EXECUTION_PLAN.md` and
   `docs/orchestrator/CONTEXT_PACKAGE.md`.
6. Implement the smallest complete chunk.
7. Run targeted validation and record evidence in `docs/orchestrator/STATUS.md`
   and `docs/IMPLEMENTATION_STATE.md`.
8. Leave one concrete next action.

## Non-Negotiable Boundaries

- Do not put customer/billing data into Orders events.
- Do not initiate payments, refunds, provider calls, or provider-side state.
- Do not send real notifications unless owner-approved runtime configuration is
  present.
- Do not issue a legal final invoice when seller or buyer legal data is missing.
- Do not log raw addresses, emails beyond bounded recipient fields, payment
  provider payloads, tokens, secrets, or raw production customer payloads.
