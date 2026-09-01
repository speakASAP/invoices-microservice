# invoices-microservice — Legacy STATE.json Archive

## Migrated 2026-09-01 — STATE.json legacy mirror archive

Archived verbatim from STATE.json's legacy mirror block prior to removal during the ecosystem-wide Wave-projection-only STATE.json standardization. Actionable blocker/follow-up items were also copied into TASKS.md.

```json
{
  "v": 1,
  "stage": "production",
  "current_goal": "Goal 1 invoices issuance MVP",
  "next_focus": "Goal 1 is runtime-complete. Future work is limited to owner-gated durable storage/corrections and dependency-gated authenticated Orders authSubject proof.",
  "updated_at": "2026-08-30",
  "schemaVersion": 1,
  "project": "invoices-microservice",
  "lifecycle": "production",
  "health": "ok",
  "activeTask": "none",
  "lastUpdated": "2026-08-30",
  "deployment": {
    "status": "production",
    "notes": "Goal 1 invoice issuance MVP is runtime-complete and deployed to statex-apps; commit-triggered auto-deploy applies to future non-documentation changes on main."
  },
  "blockers": [
    "Owner-approved runtime MinIO/S3 document storage rollout, object-reference migration application, and backfill plan is not yet authorized.",
    "Deployed authenticated checkout/runtime proof that new Orders snapshots persist customer.authSubject across active channels is not yet available.",
    "Owner-approved refund/correction workflow and credit-note policy does not exist yet."
  ],
  "followUps": [
    "IPS documentation-adoption baseline (TASK-001-bootstrap-service) completed 2026-08-30.",
    "Goal 1 is runtime-complete; future work is limited to owner-gated durable storage and corrections plus dependency-gated authenticated Orders authSubject proof.",
    "Orders event consumer code exists in src/events/rabbitmq-orders.consumer.ts but ORDERS_EVENTS_CONSUMER_ENABLED is currently false in the production ConfigMap."
  ]
}
```
