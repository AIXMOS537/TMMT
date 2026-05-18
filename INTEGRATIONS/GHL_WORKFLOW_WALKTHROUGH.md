# GoHighLevel — Workflow walkthrough (click-by-click)

**Sub-account:** TMMT Rentals / your GHL location  
**Ops URL:** `https://tmmt-ops.vercel.app`  
**Secret:** value of `GHL_WEBHOOK_SECRET` from `tmmt-os/.env.local` (must match Vercel Production)

---

## Before you start

1. **Vercel env** — `GHL_WEBHOOK_SECRET`, `GHL_API_KEY`, `GHL_LOCATION_ID` set on project **tmmt-ops**
2. **Custom fields on Contact** (Settings → Custom Fields) — create if missing:
   - `amount_due` (Text or Monetary)
   - `due_date` (Date)
3. **Tag** — `payment-overdue` will be applied by TMMT OS; you do not need to create it manually (GHL creates on first use)

---

## Workflow A — Overdue collections (tag trigger)

**Name:** `TMMT — Overdue payment alert`  
**Folder:** Automations → Workflows → **+ Create Workflow** → Start from scratch

### Trigger

1. **Add Trigger** → **Contact Tag**
2. Tag: `payment-overdue`
3. Trigger settings: **Tag is added** (not removed)
4. **Filters (recommended):**
   - Only run once per contact per 24 hours (use workflow settings or a “Goal/Event” branch if your plan supports it)
   - Optional: Contact has phone OR email

### Action 1 — Notify you

1. **+** → **Send internal notification** (or **Notification** → Team/Admin)
2. Channel: SMS + Email to **your user** (Muhammad / owner)
3. Message:

```text
OVERDUE: {{contact.name}}
Amount: {{contact.amount_due}}
Due: {{contact.payment_due_date}}
Phone: {{contact.phone}}
```

If custom fields do not merge, use GHL’s field picker and select **Contact → Custom → amount_due** and **due_date**.

### Action 2 — Task for finance

1. **+** → **Create task** (or **Opportunity Task** if tied to pipeline)
2. Title: `Collect overdue — {{contact.name}}`
3. Description:

```text
{{contact.name}} — ${{contact.amount_due}} overdue (due {{contact.due_date}})
GHL: https://app.gohighlevel.com/location/YOUR_LOCATION_ID/contacts/{{contact.id}}
```

4. Assignee: finance owner (or yourself until VA is live)
5. Due date: **Today**

### Action 3 — 24h follow-up (optional)

1. **+** → **Wait** → **24 hours**
2. **+** → **If/Else** → Condition: Contact **still has tag** `payment-overdue`
3. **Yes branch** → **Send internal notification** (shorter message: “Still overdue: {{contact.name}}”)
4. **No branch** → End (payment cleared / tag removed)

### Action 4 — Customer SMS (optional, Level A)

Only after internal alerts work. Use approved copy from `TMMT MANAGEMENT/CUSTOMERS/MESSAGE_TEMPLATE_LIBRARY.md`.

1. **+** → **Send SMS**
2. Template: payment reminder (human tone, no corporate openers)
3. **Do not** enable until wording is approved

### Publish

1. **Save** → toggle **Published** / **Active**
2. Test: add tag `payment-overdue` to a test contact manually → confirm SMS/email + task

---

## Workflow B — Pipeline stage → TMMT OS (webhook)

**Name:** `TMMT — Stage sync to ops`  
**Purpose:** Every rental pipeline stage change sends data to Supabase/Airtable queue

### Trigger

1. **Add Trigger** → **Pipeline Stage Changed** (or **Opportunity status changed**)
2. Pipeline: **TMMT Rentals** (your rental pipeline only — not credit/dealer unless you add maps)
3. Stage: **Any stage** (all stage changes)

### Action — Custom webhook

1. **+** → **Webhook** (or **Custom Webhook** / **HTTP Request**)
2. Method: **POST**
3. URL:

```text
https://tmmt-ops.vercel.app/api/webhooks/ghl
```

4. **Headers** (add one row):

| Name | Value |
|------|--------|
| `Content-Type` | `application/json` |
| `X-GHL-Secret` | *(paste `GHL_WEBHOOK_SECRET` — never share in Slack)* |

5. **Body** — Raw JSON. Map GHL merge fields where available; example structure:

```json
{
  "event": "opportunity.stage_changed",
  "pipeline_id": "{{opportunity.pipeline_id}}",
  "pipeline_name": "{{opportunity.pipeline_name}}",
  "opportunity_id": "{{opportunity.id}}",
  "contact_id": "{{contact.id}}",
  "contact": {
    "name": "{{contact.full_name}}",
    "email": "{{contact.email}}",
    "phone": "{{contact.phone}}"
  },
  "previous_stage": "{{opportunity.previous_stage_name}}",
  "stage": "{{opportunity.stage_name}}",
  "business_line": "rentals",
  "custom_fields": {
    "amount_due": "{{contact.amount_due}}",
    "vehicle": "{{contact.vehicle}}"
  }
}
```

**Important:** GHL merge field names vary by version. In the webhook builder, use **Insert variable** and pick Contact / Opportunity fields — do not guess token syntax if the picker shows different names (e.g. `{{contact.name}}` vs `{{contact.full_name}}`).

6. **Save** action

### Publish & test

1. Publish workflow
2. Move a **test contact** to another pipeline stage
3. Check TMMT OS: **Internal → Sync** (`/internal/sync`) for a pending row
4. Verify Airtable **Leads** row if Airtable env is configured

---

## How overdue tag gets applied (outside GHL UI)

Daily (or manual):

```bash
cd ~/Desktop/AIX_Command_Center/TMMT\ MANAGEMENT
# After ghl_contact_map.json is filled:
export GHL_CONTACT_MAP_JSON="AUTOMATIONS/WEBHOOKS/ghl_contact_map.json"
python3 AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py --dry-run
python3 AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py
```

That POSTs to `https://tmmt-ops.vercel.app/api/webhooks/ghl/overdue`, which adds tag `payment-overdue` → **Workflow A** runs.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Webhook 401 | `X-GHL-Secret` ≠ Vercel `GHL_WEBHOOK_SECRET` |
| Webhook 400 | Body missing `contact_id` or `stage` |
| Tag workflow never runs | Tag not applied — check `GHL_API_KEY` + `GHL_LOCATION_ID` on Vercel |
| Merge fields empty | Set custom fields on contact before push script runs |
| Duplicate alerts | Add 24h filter or remove tag when payment recorded |
| Stage sync no Airtable row | Set `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_LEADS_TABLE` on Vercel |

---

## Quick test commands

```bash
SECRET=$(grep '^GHL_WEBHOOK_SECRET=' "TMMT MANAGEMENT/tmmt-os/.env.local" | cut -d= -f2-)

# Overdue endpoint
curl -sS -X POST "https://tmmt-ops.vercel.app/api/webhooks/ghl/overdue" \
  -H "Content-Type: application/json" \
  -H "X-GHL-Secret: $SECRET" \
  -d '{"contact_id":"REAL_GHL_CONTACT_ID","customer_name":"Test","amount_due":"100","due_date":"2026-05-10"}'

# Stage sync (use example JSON, replace IDs)
curl -sS -X POST "https://tmmt-ops.vercel.app/api/webhooks/ghl" \
  -H "Content-Type: application/json" \
  -H "X-GHL-Secret: $SECRET" \
  -d @AUTOMATIONS/WEBHOOKS/ghl_opportunity_stage_changed.example.json
```

---

See also: `GHL_WEBHOOK_SETUP.md` · `GHL_OVERDUE_WORKFLOW_SETUP.md`
