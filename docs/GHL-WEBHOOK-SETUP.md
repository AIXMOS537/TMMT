# GHL webhook → Supabase notes

When a contact is tagged in GHL, mirror activity into TMMT Supabase for owner visibility.

## Endpoint

```
POST https://<your-domain>/api/webhooks/ghl
Header: x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>
Content-Type: application/json
```

## Payload (example)

```json
{
  "email": "customer@example.com",
  "event": "tag_added",
  "tags": ["ready-for-aixmos", "rental-completed"]
}
```

## Behavior

1. Matches `active_customers.email` → appends line to `service_notes`  
2. Else matches `incoming_leads.email` → appends to `notes`  
3. Else returns `{ ok: true, skipped: "no matching contact" }`

## Vercel env

| Variable | Purpose |
|----------|---------|
| `GHL_WEBHOOK_SECRET` | Validates `x-ghl-webhook-secret` header |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side update (already required) |

## GHL workflow step

1. Trigger: Contact tag added (e.g. `ready-for-aixmos`)  
2. Action: Custom webhook → URL above  
3. Body: map contact email + tag name  

## Security

- Always set `GHL_WEBHOOK_SECRET` in production  
- Never expose service role key to GHL or the browser  
