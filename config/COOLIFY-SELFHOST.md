# Self-host on Brainiac (Coolify) — zero cloud deploy caps

Run the whole app (TMMT OS + the brain + HAILMARY surfaces) on **your** Brainiac
PC via Docker/Coolify, reachable over Tailscale. No Vercel 100/day limit, no
per-deploy metering. This is the deploy side of the Sovereign Stack
(`docs/SOVEREIGN-STACK.md`).

## What's in the repo for this
- `next.config.ts` → `output: "standalone"` (self-contained server bundle).
- `Dockerfile` (+ `.dockerignore`) → builds the standalone image.

## Option A — Coolify (recommended, a self-hosted PaaS)
1. Install Coolify on Brainiac: `curl -fsSL https://coolify.io/install.sh | bash`.
2. Open Coolify (it serves a web UI) over Tailscale.
3. **New Resource → Application → from this Git repo** (or "Dockerfile").
4. Build pack: **Dockerfile**. Port: **3000**.
5. Add env vars (same as Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `MEMORY_API_TOKEN`, `OLLAMA_URL`, `QUO_WEBHOOK_SECRET`, `CRON_SECRET`,
   `TELEGRAM_BOT_TOKEN`, `IMESSAGE_BRIDGE_URL`, etc.
6. Deploy. Coolify gives unlimited rebuilds and can auto-deploy on git push to a
   branch **you** choose — without any daily cap.
7. Expose it on the tailnet (Coolify + Tailscale) or via a Cloudflare Tunnel for
   public URLs without opening your IP.

## Option B — plain Docker (no PaaS)
```bash
# on Brainiac, in the repo:
docker build -t tmmt-os .
docker run -d --name tmmt-os -p 3000:3000 --env-file .env --restart unless-stopped tmmt-os
tailscale serve https / http://localhost:3000   # reachable on the tailnet
```

## Crons without Vercel
Vercel crons (`vercel.json`) only run on Vercel. Self-hosted, drive them from a
local scheduler on Brainiac:
```cron
# every day 8am ET — morning brief
0 12 * * *  curl -fsS -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/morning-brief
# every 5 min — Quo poll fallback
*/5 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/quo-poll
# hourly — ClickUp ingest
0 * * * *   curl -fsS -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/ingest-clickup
```

## Why this matters
- **No deploy caps** — rebuild as often as you want.
- **Local-first** — pairs with Ollama (local AI) so the app *and* its
  intelligence run on your hardware. A dead cloud account can't stop you.
- **Per-client appliance** — the same image is what ships on the $50k
  supercomputer; clients run sealed + licensed, never metered.

## Connected-tools → brain (live ops in recon/brief)
With the app self-hosted, point these at it so the brain sees live ops:
- **ClickUp:** `CLICKUP_API_TOKEN` set → the `ingest-clickup` cron pulls tasks.
- **Slack:** Slack app → Event Subscriptions → `…/api/webhooks/slack`; set
  `SLACK_SIGNING_SECRET`.
- **GHL:** already webhooked; now also logged to the brain for visibility.
Then `hailmary recon` / the morning brief reflect real-time operations.
