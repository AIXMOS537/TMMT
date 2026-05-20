# GHL Dealer Sales pipeline (LotOS)

Mirror of the rental sync pattern — stages flow into **Command Center** `incoming_leads` and appear in **LotOS** at `/internal/dealer/leads`.

## Pipeline

| Item | Value |
|------|--------|
| **Name** | `Dealer Sales` or existing `Applicants – Dealership` |
| **Type** | Opportunity (one opp per buyer) |
| **TMMT OS handler** | `opportunity.stage_changed` → `syncDealerLeadFromGhl` |

## Stages

| Stage | Maps to `incoming_leads.status` |
|-------|----------------------------------|
| New lead | New Lead |
| Contacted | New Lead |
| Qualified | Qualified |
| Appointment set | Qualified |
| Showed | Contracting |
| Application in | Contracting |
| Approved / conditional | Contracting |
| Sold / placed | Closed |
| Lost | Closed |

## Webhook (WF-00 dealer)

1. GHL → **Automation → Workflow**
2. Trigger: **Pipeline Stage Changed** → Pipeline: Dealer Sales (or Applicants – Dealership)
3. Action: **Webhook** → `POST https://<tmmt-os-host>/api/webhooks/ghl`
4. Header: `X-GHL-Secret: <GHL_WEBHOOK_SECRET>`
5. Body: include `pipeline_name`, `stage`, `contact_id`, `opportunity_id`, contact email/phone

Optional JSON field: `"business_line": "dealer"` for explicit routing.

## Env

```bash
COMMAND_CENTER_SUPABASE_URL=   # same project as rentals fleet/leads
COMMAND_CENTER_SUPABASE_SERVICE_KEY=
GHL_WEBHOOK_SECRET=
# Optional stage map entry — see GHL_PIPELINE_STAGE_MAP.example.json
GHL_PIPELINE_STAGE_MAP_JSON=
```

## Stage map snippet

Add to `GHL_PIPELINE_STAGE_MAP_JSON`:

```json
{
  "DEALER_PIPELINE_ID": {
    "business_line": "dealer",
    "pipeline_name": "Dealer Sales",
    "stages": {
      "new lead": "inquiry",
      "contacted": "contacted",
      "qualified": "qualifying",
      "appointment set": "qualifying",
      "showed": "payment_pending",
      "sold / placed": "closed_won",
      "lost": "closed_lost"
    }
  }
}
```

## Verify

1. Move a test opportunity in GHL dealer pipeline.
2. Check webhook response includes `dealer_lead_sync: { ok: true }`.
3. Open `/internal/dealer/leads` — row should match contact + stage.
