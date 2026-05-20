# Airtable — Ops Locations schema

Base table name (default): **Ops Locations** (`AIRTABLE_OPS_LOCATIONS_TABLE`).

Use for market roster → Supabase `ops_locations` via automation:

`POST /api/webhooks/airtable` with header `X-Sync-Secret: $SYNC_WEBHOOK_SECRET`

```json
{
  "event": "ops_location.upsert",
  "table": "Ops Locations",
  "airtable_record_id": "recXXXXXXXX"
}
```

## Columns

| Column (Airtable) | Field type | Maps to Supabase |
|-------------------|------------|------------------|
| Slug | Single line | `slug` (unique key) |
| Name | Single line | `name` |
| GHL Pipeline ID | Single line | `ghl_pipeline_id` |
| GHL Pipeline Name | Single line | `ghl_pipeline_name` |
| ClickUp List ID | Single line | `clickup_list_id` |
| Overseas Assignee Email | Email | `overseas_assignee_email` |
| Courier Prefs | Long text (JSON) | `courier_prefs` jsonb |
| Active | Checkbox | `active` (unchecked = false) |

## Courier Prefs JSON example

```json
{
  "preferred": ["partner_a", "partner_b"],
  "notes": "No Sunday pickups"
}
```

## Security

- Do **not** store Supabase keys, ClickUp tokens, or passwords in Airtable.
- Webhook secret lives only in Vercel env (`SYNC_WEBHOOK_SECRET`).

See also: `INTEGRATIONS/INTAKE_UNIFIED.md`, `INTEGRATIONS/OPS_ROUTING_ARCHITECTURE.md`.
