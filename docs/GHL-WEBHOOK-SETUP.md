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

## Payment events

When GHL sends a payment or revenue tag, a row is inserted into `customer_payments`:

**Trigger:** `event` contains `payment`, `invoice`, `subscription`, or `order`, OR tags include `member-97`, `credit-guidance-active`, etc.

```json
{
  "email": "customer@example.com",
  "event": "payment_received",
  "amount": 97,
  "payment_method": "Stripe",
  "product": "AIXMOS Membership",
  "tags": ["member-97"]
}
```

**Response (when no CRM match but payment recorded):**

```json
{ "ok": true, "payment": { "recorded": true, "id": "uuid" } }
```

## Local testing

```bash
npm run ghl:check              # env audit
npm run ghl:test-webhook tag   # tag sync
npm run ghl:test-webhook program
npm run ghl:test-webhook payment
```

Set `GHL_TEST_BASE_URL` (default `http://localhost:3000`) and `GHL_TEST_EMAIL` for test payloads.

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
