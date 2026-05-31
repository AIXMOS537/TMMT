# Dispatch Core — Operator Runbook

## Routes
- `/dispatch` — cockpit (map + queue)
- `/dispatch/incident/new` — create incident
- `/dispatch/incident/[id]` — detail + override panel
- `/dispatch/units` — unit roster + manual location
- `/dispatch/responders` — responder link admin
- `/dispatch/me` — responder self-view

## Day-1 setup
1. Set `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAPBOX_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID`, `AIXMOS_AGENT_HOST`, optional `AIXMOS_AGENT_TOKEN` in `.env`.
2. Apply `supabase/migrations/20260530120000_rescue_dispatch_core.sql` (Supabase SQL Editor or `supabase db push --linked`).
3. For each responder, set `profiles.telegram_chat_id` (responder → /start the bot → record their chat_id).
4. For each vehicle, set `fleet.vehicle_class` and `fleet.capability_tags`.
5. Insert `units` rows pairing a fleet vehicle + responder with a callsign.

## Failure modes
- **CAPTAIN down:** deterministic SQL ranking is used; `reasoning_json.captain_skipped=true` is logged.
- **Mapbox down:** map shows a banner; queue/forms still work.
- **Telegram down:** assignment proceeds; the responder ping is silently skipped.
- **Realtime drops:** UI polls every 10s via the lock tick; assignment freshness within 10s of reality.

## Cost guardrails
- Mapbox geocoding is debounced 250ms client-side and cached server-side (in-process LRU, 500 entries, 24h TTL).
- The `geocodeAddress` server action is auth-gated, so anonymous traffic cannot burn quota.

## What's NOT in Core (deferred)
Responder mobile app · public intake · full AI dispatcher productization · equipment loadout · SLA dashboards · self-signup · billing · vehicle conversion · compliance pack.
