# Launch Readiness — go-live checklist

Everything below is **built and applied**. This is the switch-flipping list to go
from "cooked" to "serving daily." Work top to bottom.

## 1. Environment variables
Already in use: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GHL_*`, `CRON_SECRET`.

Set these to light up the new systems:

| Var | Purpose | Needed for |
|---|---|---|
| `MEMORY_API_TOKEN` | Bearer for `/api/memory` | brain access from agents + HAILMARY |
| `QUO_WEBHOOK_SECRET` | `x-quo-webhook-secret` | Quo inbound support |
| `QUO_API_KEY` (+ `QUO_PHONE_NUMBER_ID`) | OpenPhone REST | poll fallback `/api/cron/quo-poll` |
| `TELEGRAM_BOT_TOKEN` | assignee pings | routing notifications |
| `IMESSAGE_BRIDGE_URL` (+ `IMESSAGE_BRIDGE_TOKEN`) | Tailscale Mac bridge | owner escalation to work cell |
| `BACKEND_LOCK_ENABLED` | `true` to enforce the lock | once client installs exist |
| `NEXT_PUBLIC_SENTRY_DSN` | error monitoring | recommended for prod |

## 2. Webhooks
- **Quo** support number → `POST /api/webhooks/quo`, header `x-quo-webhook-secret` = `QUO_WEBHOOK_SECRET` (events: `message.received`, `call.completed`).
- **GHL** → existing `/api/webhooks/ghl/*` (campaigns/ads/leads).

## 3. Cron jobs (Vercel cron or external scheduler, Bearer `CRON_SECRET`)
- `GET /api/cron/quo-poll` — every ~5 min (safety net for missed Quo webhooks).
- Existing: `journey-recompute`, `marketing-kpi-ghl`.

## 4. Data setup (one-time, per the registries)
- **`customer_services`** — load each client's opted-in service (gates support routing).
- **`routing_candidates`** — seeded from vendors/profiles/units; set real
  `capability_tags` + `vertical_slugs` + availability so ranking has signal.
- **`verticals`** — add a row per business line as they launch (vertical-agnostic).
- **`comm_channels`** — fill the GHL DID; confirm working hours on the work cell.
- **`installations`** — create per client org; drive `paid → setup → comprehension → active`.

## 5. The mesh (HAILMARY + brain)
- Tailscale on Brainiac + work Mac + carry Mac + iPhones (one tailnet, MagicDNS).
- Run the app on Brainiac (or cloud); `tailscale serve` the memory API.
- `bash scripts/hailmary-setup.sh --role work|carry …` on the Macs; iPhone Shortcut (see `docs/HAILMARY.md`).

## 6. Smoke tests (prove it live)
1. `hailmary status` → brain OK.
2. `hailmary recall "Lopez"` → returns history/facts.
3. POST a sample payload to `/api/webhooks/quo` (with secret) → a `support_request`
   appears in `memory_events`; a covered caller creates a `cases` row and routes.
4. Force a no-candidate case → owner escalation event logged (and iMessage if bridge up).
5. Set `BACKEND_LOCK_ENABLED=true` with a non-activated test org → that user hits `/locked`; owner is unaffected.

## 7. Migrations applied (all live)
`20260616000000_memory_fabric` · `…100000_quo_support_dispatch` ·
`…200000_work_routing` · `…300000_installation_licensing` · `…400000_comm_channels`.

## 8. Go / no-go
- [ ] Env set · [ ] Quo webhook pointed · [ ] crons scheduled · [ ] candidates tagged
- [ ] mesh up · [ ] smoke tests pass · [ ] Quo credits topped up · [ ] Sentry DSN set
- [ ] (when ready) `BACKEND_LOCK_ENABLED=true`
