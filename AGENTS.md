# Repository Agent Instructions

Shared rules live here:

- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Work in this remote repository only:

```bash
ssh alfares
cd /home/ssf/Documents/Github/invoices-microservice
```

Do not save project code under `/Users/Sergej.Stasok/Documents`.

## required reading

Before implementation, read:

- `README.md`
- `BUSINESS.md`
- `SYSTEM.md`
- `AGENTS.md`
- `AGENT_OPERATIONS.md`
- `TASKS.md`
- `STATE.json`
- `docs/06_architecture/INTEGRATION_CONTRACT.md`
- `docs/17_governance/PROJECT_INVARIANTS.md`
- `docs/IMPLEMENTATION_ORCHESTRATOR.md` and `docs/orchestrator/*` (pre-existing implementation orchestration pack)

## authority

The project owner approves invoice policy. `BUSINESS.md`, `docs/00_constitution/CONSTITUTION.md` and `docs/01_vision/VISION.md` are protected and require human approval before change. Agents must not redefine invoice scope, relax numbering uniqueness, or introduce refund, credit-note or correction behavior without explicit owner approval.

## intent preservation system

Preserve the chain of intent across:

`Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation`

Use the compact IPS pack alongside the canonical IPS artifact set:

- `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/orchestrator/MASTER_PROMPT.md` where present, plus `docs/orchestrator/INTENT.md`, `GOALS.md`, `PLAN.md`, `PROJECT_INVARIANTS.md`, `CONTEXT_PACKAGE.md`, `EXECUTION_PLAN.md`, `PRE_CODING_GATE.md`, `READINESS_GATES.md`, `PROMPTS.md`, `STATUS.md`
- `implementation-goals/README.md`

Coding must not begin until the selected task has upstream traceability, invariant review, sensitive-data classification, contract impact review, a validation plan and a pre-coding gate decision.

## preserved boundary

`invoices-microservice` owns invoice issuance records, invoice numbering, document rendering, invoice download links, and delivery attempts.

Orders owns order records, order item snapshots, lifecycle state, and `orders.events`. Payments owns payment identity, provider reconciliation, refunds, and status. Notifications owns outbound delivery. Logging owns log storage. Auth owns reusable identity/profile data. Do not move those domains into invoices.

## safety and operations

- Never commit secrets, credentials, or raw production/customer data
- Never print raw customer addresses, tokens, provider payloads, or secrets
- Keep the system grounded in proven repository facts
- Use `[MISSING: ...]` or `[UNKNOWN: ...]` instead of inventing facts in working notes
- Keep validation debt separate from current-task failures
- Prefer the narrowest valid validation command before broad test suites
- Use `docs-rag-microservice` for bounded discovery when it is healthy, then verify deployment, security, database, integration and public-contract facts against the cited Git source. Git remains authoritative. Authority and fallback rules: `/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

## project-specific rules

- Generate one proforma invoice on `orders.order.created.v1`.
- Generate one final tax invoice on `orders.order.paid.v1`.
- Treat each Orders event `eventId` as idempotency input.
- Treat `(orderId, invoiceType)` as the durable issuance idempotency key.
- Never invent seller, buyer, VAT, payment, or address fields. If required legal data is missing, create or update a blocked invoice record and log a sanitized blocker.
- Never allocate an invoice number outside the transactional annual-sequence allocator.
- Refunds, credit notes and corrections remain out of scope until the owner approves that workflow.
- Plan implementation work for maximum safe parallel agent execution: split owner-approved work into independent lanes, name blockers and dependencies, assign non-overlapping file ownership.
- End every assistant response with a final line beginning `Next step:`.

## required final report

The final task report must include:

- files changed
- documents created or revised
- validation commands and results
- validation debt used or created
- active blockers as `[MISSING: ...]` or `[UNKNOWN: ...]`
- deviations from scope
- next concrete action

## Service-to-service authentication
For machine service identity, follow the sole canonical [`SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md). It is not reproduced here.
