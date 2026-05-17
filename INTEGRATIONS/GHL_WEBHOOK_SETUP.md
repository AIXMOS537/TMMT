# GHL Webhook Setup — TMMT OS

**Production base (ops):** `https://tmmt-ops.vercel.app`  
**Portal proxy:** rewrites `/api/webhooks/*` from portal host → ops (see `tmmt-os/vercel.portal-rewrites.json`)

## 1. Opportunity stage changed → CRM sync

| Item | Value |
|------|--------|
| **URL** | `POST {BASE}/api/webhooks/ghl` |
| **Header** | `X-GHL-Secret: {GHL_WEBHOOK_SECRET}` |
| **GHL trigger** | Workflow → Opportunity stage changed |

Example payload: `AUTOMATIONS/WEBHOOKS/ghl_opportunity_stage_changed.example.json`

**Flow:** GHL → Supabase `crm_sync_records` + Airtable (pending verify) → team approves → case created.

## 2. Overdue payment → collections workflow

| Item | Value |
|------|--------|
| **URL** | `POST {BASE}/api/webhooks/ghl/overdue` |
| **Header** | `X-GHL-Secret: {GHL_OVERDUE_WEBHOOK_SECRET}` or same as `GHL_WEBHOOK_SECRET` |
| **GHL trigger** | Tag `payment-overdue` (workflow in `AUTOMATIONS/GHL_OVERDUE_WORKFLOW_SETUP.md`) |

**Push from Supabase:** `AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py` (cron or n8n)

```json
{
  "contact_id": "GHL_CONTACT_ID",
  "customer_name": "Jane Doe",
  "amount_due": "450",
  "due_date": "2026-05-10"
}
```

## 3. Public intake (immediate case)

| Item | Value |
|------|--------|
| **URL** | `POST {BASE}/api/intake` |
| **Header** | `X-Intake-Secret: {INTAKE_WEBHOOK_SECRET}` |

Use for forms/Zapier that should create a case **without** Airtable verification.

## 4. Airtable verified → promote to case

| Item | Value |
|------|--------|
| **URL** | `POST {BASE}/api/webhooks/airtable` |
| **Header** | `X-Sync-Secret: {SYNC_WEBHOOK_SECRET}` |

## Vercel env (required)

```
GHL_WEBHOOK_SECRET=
GHL_OVERDUE_WEBHOOK_SECRET=   # optional; falls back to GHL_WEBHOOK_SECRET
GHL_API_KEY=                  # outbound tags (overdue + workflow engine)
GHL_LOCATION_ID=
GHL_PIPELINE_STAGE_MAP_JSON=  # copy from GHL_PIPELINE_STAGE_MAP.example.json
SYNC_WEBHOOK_SECRET=
INTAKE_WEBHOOK_SECRET=
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_LEADS_TABLE=Leads
```

## Smoke test

```bash
cd "TMMT MANAGEMENT/tmmt-os"
export TMMT_OPS_URL=https://tmmt-ops.vercel.app
export GHL_WEBHOOK_SECRET=your-secret
./scripts/smoke-crm-sync.sh
```
