# Invoices Project Invariants

| ID | Rule | Validation |
| --- | --- | --- |
| INV-INV-001 | Every issued invoice is idempotent by `(orderId, type)`. | Unit tests and DB unique index. |
| INV-INV-002 | Invoice numbers are unique and allocated from type/year sequences. | Unit tests and DB unique index. |
| INV-INV-003 | Orders events remain trigger-only and do not carry customer/billing data. | Contract review. |
| INV-INV-004 | Seller, buyer, address, tax, and payment facts are never invented. Missing legal data produces a blocked invoice record. | Input validation tests. |
| INV-INV-005 | Payment provider details, refunds, and reconciliation stay in Payments. | Scope review. |
| INV-INV-006 | Real notification sends are optional and config-gated. | Delivery client tests/review. |
| INV-INV-007 | Logs must not include raw customer addresses, tokens, provider payloads, secrets, or raw production customer payloads. | Source review and sensitive scan. |
