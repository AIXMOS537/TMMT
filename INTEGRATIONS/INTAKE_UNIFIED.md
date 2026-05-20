# Unified intake — GHL, website, team

All paths should end with: **intake row** (optional) → **case** → **sync_event** → **routing** (`executeRouting`).

## 1. GoHighLevel (CRM sync)

Workflow: Opportunity stage changed → webhook.

```bash
curl -sS -X POST "https://YOUR-APP.vercel.app/api/webhooks/ghl" \
  -H "Content-Type: application/json" \
  -H "X-Ghl-Secret: $GHL_WEBHOOK_SECRET" \
  -d '{
    "contact_id": "contact_123",
    "opportunity_id": "opp_456",
    "pipeline_id": "pipe_789",
    "pipeline_name": "TMMT Dispatch — Dallas",
    "stage": "Pickup Scheduled",
    "contact": { "name": "Acme Freight", "email": "ops@acme.com" }
  }'
```

Creates `sync_events` + `crm_sync_records`, pushes Airtable verify row, runs routing (ClickUp/agent/dispatch load when case exists).

## 2. Website + public API

- Form: `https://YOUR-APP/intake` (server action → `processUnifiedIntake`)
- API:

```bash
curl -sS -X POST "https://YOUR-APP.vercel.app/api/intake" \
  -H "Content-Type: application/json" \
  -H "X-Intake-Secret: $INTAKE_WEBHOOK_SECRET" \
  -d '{
    "customer_name": "Jane Doe",
    "subject": "Need hotshot Dallas to Houston",
    "request_type": "delivery",
    "source": "zapier",
    "tags": ["delivery"]
  }'
```

## 3. Team manual

Same as API with `source: "team"` or use internal **New intake** → `/intake`.

## 4. Airtable (after verify)

```bash
curl -sS -X POST "https://YOUR-APP.vercel.app/api/webhooks/airtable" \
  -H "Content-Type: application/json" \
  -H "X-Sync-Secret: $SYNC_WEBHOOK_SECRET" \
  -d '{
    "airtable_record_id": "recXXXXXXXX",
    "verified_by": "ops@tmmt.com"
  }'
```

## Secrets (Vercel)

| Header | Env var |
|--------|---------|
| `X-Ghl-Secret` | `GHL_WEBHOOK_SECRET` |
| `X-Intake-Secret` | `INTAKE_WEBHOOK_SECRET` |
| `X-Sync-Secret` | `SYNC_WEBHOOK_SECRET` |

Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `CLICKUP_API_TOKEN`.
