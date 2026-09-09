# 20 · INTEGRATION AUDIT

Only integrations with **code evidence** are listed. Documentation-only claims were excluded.

| Service | Purpose | Auth | Direction | Failure handling | Status |
|---|---|---|---|---|---|
| **Supabase** | DB, auth, storage, edge | anon + service-role | ↔ | throws on read failure (`queries.ts`); offline cache fallback | 🟢 |
| **GoHighLevel** | CRM, checkout, voice, KPI | `GHL_WEBHOOK_SECRET`, `GHL_VOICE_WEBHOOK_SECRET` | ↔ | **idempotency keys**, tested | 🟢 |
| **Airtable** | Leads verification, ops locations | `SYNC_WEBHOOK_SECRET` + API key | ↔ | `sync_events` log | 🟠 **should have been retired** |
| **Vercel** | Hosting, cron | platform | — | **20/20 recent deploys BLOCKED** | 🔴 |
| **Stripe** | Payments, Connect | webhook sig | ↔ | per-slug routes | 🟡 |
| **Twilio** | SMS | account creds | ↔ | `twilio-send.ts` tested; DNC + quiet-hours gated | 🔵 never sent |
| **Anthropic** | LLM | `@anthropic-ai/sdk` 0.104 | → | via `llm-router` | 🟡 |
| **Ollama** | Local LLM (free lane) | `OLLAMA_URL` | → | fallback chain | 🟡 |
| **NVIDIA NIM** | LLM fallback | `NVIDIA_API_KEY` | → | fallback chain | 🟡 |
| **Sentry** | Errors | DSN | → | instrumentation hooks | 🟢 |
| **Mixpanel** | Product analytics | `NEXT_PUBLIC_MIXPANEL_TOKEN` | → | client-side | 🟢 |
| **ClickUp** | Task sync | API token | → | `clickup_tasks` **0 rows** | ⚫ |
| **Telegram** | Mission digests | bot token | → | CI cron | 🟢 |
| **Cal.com** | Booking | per-slug webhook | ← | — | 🟡 |
| **Leaflet / OSM Nominatim** | Maps, geocoding | none (deliberate) | → | replaced Mapbox to avoid signup | 🟢 |
| **Command Center bridge** | Cross-project read | separate service key | ← | read-only by design | 🟡 |

## Notes
- **Documented but not integrated:** no e-signature, no identity-verification provider, no accounting integration, no telematics, no VIN/vehicle-data service. Several are referenced in `docs/` — none exist in code. A rental business restarting will need e-sign and ID verification.
- **`ClickUp` is dead.** Full lib + migrations (`clickup_tasks_nullable_case`) and 0 rows.
- **Leaflet over Mapbox** (commit `604c25ece`, "zero-signup map") is a good cost-discipline decision.
- **Secrets** are all env-based; none committed; `pii-guard.yml` scans every push.
