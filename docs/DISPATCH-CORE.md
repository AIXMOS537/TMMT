# Dispatch Core — Operator Runbook

## Routes
- `/dispatch` — cockpit (map + queue)
- `/dispatch/incident/new` — create incident
- `/dispatch/incident/[id]` — detail + override panel
- `/dispatch/units` — unit roster + manual location
- `/dispatch/responders` — responder link admin
- `/dispatch/me` — responder self-view

## Day-1 setup
1. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID`, `AIXMOS_AGENT_HOST`, optional `AIXMOS_AGENT_TOKEN` in `.env`. (Map and geocoding use OpenStreetMap — no keys required.)
2. Apply `supabase/migrations/20260530120000_rescue_dispatch_core.sql` (Supabase SQL Editor or `supabase db push --linked`).
3. For each responder, set `profiles.telegram_chat_id` (responder → /start the bot → record their chat_id).
4. For each vehicle, set `fleet.vehicle_class` and `fleet.capability_tags`.
5. Insert `units` rows pairing a fleet vehicle + responder with a callsign.

## Failure modes
- **CAPTAIN down:** deterministic SQL ranking is used; `reasoning_json.captain_skipped=true` is
  recorded on the assignment row, and `captain-dispatch` appears under `degraded` on `/api/health`
  with the reason and whether `AIXMOS_AGENT_HOST` was even set.
- **CAPTAIN unreachable from production (the standing state):** the agent host listens on BRAINIAC
  `:7777` behind a firewall rule scoped to the tailnet, so Vercel cannot reach it — measured
  2026-09-09, it had served zero requests in three days. Setting `AIXMOS_AGENT_HOST` to that address
  would not help; the host has to move somewhere the app can reach, or CAPTAIN stays a local-dev
  refinement and deterministic ranking is the production path.
- **OSM tile server down:** map shows blank tiles; queue/forms still work.
- **Nominatim down or rate-limited:** address autocomplete returns empty; user can still create incidents by entering raw coordinates if you add a fallback input later.
- **Telegram down:** assignment proceeds; the responder ping is silently skipped.
- **Realtime drops:** UI polls every 10s via the lock tick; assignment freshness within 10s of reality.

## Cost guardrails
- Nominatim geocoding is debounced 250ms client-side and cached server-side (in-process LRU, 500 entries, 24h TTL). Includes a unique User-Agent per Nominatim's usage policy.
- The `geocodeAddress` server action is auth-gated, so anonymous traffic cannot burn quota.

## What's NOT in Core (deferred)
Responder mobile app · public intake · full AI dispatcher productization · equipment loadout · SLA dashboards · self-signup · billing · vehicle conversion · compliance pack.
