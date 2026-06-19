# GO-LIVE TONIGHT → running tomorrow

One ordered pass to turn on everything built this cycle. `[YOU]` = only you can
do it (secrets, hardware, dashboards). Everything else is copy-paste. The DB
migrations are already applied live — nothing to re-run there.

═══════════════════════════════════════════════════════════════════
## TONIGHT (~60–90 min)
═══════════════════════════════════════════════════════════════════

### 0. Unblock the basics  `[YOU]`
- [ ] **Top up Quo credits** (this is what blocked the John Lopez texts).
- [ ] Turn on **auto-recharge + a usage alarm** on Quo and Anthropic so "out of
      credits" never happens again.

### 1. Set environment variables  `[YOU]`
On the host that serves the app (home M1 via Coolify, or Vercel). Already have:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GHL_*`, `CRON_SECRET`.
Add:

| Var | Why |
|---|---|
| `MEMORY_API_TOKEN` | brain + HAILMARY on every device |
| `QUO_WEBHOOK_SECRET` | Quo inbound support |
| `QUO_API_KEY` (+ `QUO_PHONE_NUMBER_ID`) | poll fallback |
| `TELEGRAM_BOT_TOKEN` | assignee pings |
| `IMESSAGE_BRIDGE_URL` (+ `IMESSAGE_BRIDGE_TOKEN`) | owner work-cell escalation |
| `OLLAMA_URL` (+ `OLLAMA_MODEL`) | local-first AI (point at the M1/Brainiac) |
| `SLACK_SIGNING_SECRET` | Slack→brain ingest |
| `CLICKUP_API_TOKEN` | ClickUp→brain ingest |
| `NEXT_PUBLIC_SENTRY_DSN` | error monitoring (recommended) |
| `BACKEND_LOCK_ENABLED` | leave **unset** until client installs exist |

### 2. The mesh + the brain host (home M1, not Brainiac)
Brainiac (Windows) crashes → the **home M1 is the always-on host/anchor**.
- [ ] `[YOU]` Tailscale on: home M1, work Mac, carry Mac, both iPhones (one tailnet, MagicDNS on).
- [ ] On the home M1, run the app (Coolify or `npm run build && npm run start`) and expose it:
      `tailscale serve https / http://localhost:3000`
- [ ] Local AI on the M1:
      `curl -fsSL https://ollama.com/install.sh | sh && ollama pull qwen2.5:14b && ollama pull nomic-embed-text && ollama pull llama3.2-vision`

### 3. HAILMARY on every device
On the **home M1** (becomes you, always-on — installs the LaunchAgent automatically):
```
bash scripts/hailmary-setup.sh --role home --brain-url https://<m1>.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
```
On the **work** Mac and **carry** Mac:
```
bash scripts/hailmary-setup.sh --role work  --brain-url https://<m1>.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
bash scripts/hailmary-setup.sh --role carry --brain-url https://<m1>.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
```
`[YOU]` Home + work Macs: grant **Full Disk Access** to Terminal (iMessage bridge), keep home M1 **plugged in + never-sleep-on-power**, ideally on a **UPS**.
**iPhones / Fire Stick / PS5 / TV:** open `https://<m1>.<tailnet>.ts.net/hailmary`, paste the token, name the device, **Install** (Add to Home Screen).

### 4. Quo support line  `[YOU]`
- [ ] Point the Quo support number's webhooks (`message.received`, `call.completed`)
      at `https://<host>/api/webhooks/quo` with header `x-quo-webhook-secret = QUO_WEBHOOK_SECRET`.

### 5. Deploy (local-first, no quota burn)
- [ ] `bin/ship prod` from the repo (CLI deploy), **or** run on the M1 via Coolify
      (`docs/COOLIFY-SELFHOST.md`). Git pushes no longer auto-deploy preview branches.
- [ ] PR **#45**: merge once the Vercel 24h window clears (checks then go green/
      skipped), or just deploy from the branch with `bin/ship prod` tonight.

═══════════════════════════════════════════════════════════════════
## TOMORROW MORNING (first run, ~20 min)
═══════════════════════════════════════════════════════════════════

### 6. Smoke test (prove it live)
```
hailmary status                 # brain reachable
hailmary recall "Lopez"         # brain remembers
hailmary brief                  # operative situation report
```
- [ ] Send a test text to the Quo support number → confirm a `support_request`
      event lands in the brain and routes to a candidate (assignee pinged).
- [ ] Retry the John Lopez text now that credits are topped up.

### 7. Load real data so routing/brief have signal  `[YOU]`
- [ ] `customer_services` — who opted into what (gates support).
- [ ] `routing_candidates` — tag your people/vendors with `capability_tags` + availability.
- [ ] `comm_channels` — confirm the GHL DID + work-cell hours.

### 8. Turn the team on (TMMT + Moe)
- [ ] Send the two staged **Slack drafts** (#general, #moe-ops) — first-day setup.
- [ ] Schedule crons (Vercel cron or M1 crontab — see `docs/COOLIFY-SELFHOST.md`):
      `morning-brief`, `quo-poll`, `ingest-clickup`.

### 9. Owner intel (optional, private)
- [ ] `bash scripts/photo-intel.sh ~/Pictures --limit 40 --push` (local vision read of your focus → brain).

═══════════════════════════════════════════════════════════════════
## DON'T-FORGET SWITCHES  `[YOU]`
═══════════════════════════════════════════════════════════════════
- [ ] Supabase dashboard → enable **Leaked Password Protection**.
- [ ] Supabase **PITR / backups** on.
- [ ] `BACKEND_LOCK_ENABLED=true` **only after** seeding `installations` for paying clients.
- [ ] UPS on the home M1 + router (rides out power outages).

Full references: `LAUNCH-READINESS.md` · `FIRST-DAY-SETUP.md` · `HAILMARY-ALWAYS-ON.md`
· `HAILMARY-FAILOVER.md` · `HAILMARY-DEVICES.md` · `SOVEREIGN-STACK.md` ·
`COOLIFY-SELFHOST.md` · `CHANNEL-TOPOLOGY.md` · `QA-SECURITY-REPORT.md` · `GO-TO-MARKET.md`.
