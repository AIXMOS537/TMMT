# Phase 9 — Notification Wiring Runbook

Get Slack + Telegram + iMessage handoff pings firing from `submitCreditFundingIntake`. Time: ~15 min total. Cost: $0 if you stop after Telegram + Slack; ~5 min more for iMessage via Cloudflare Tunnel.

Order matters only for the manual-UI parts. The shell script at the end wires whatever you have into Vercel and redeploys.

---

## Step 1 — Slack (3 min, manual UI)

You need a Slack incoming webhook URL pointing at the channel you want pinged.

1. Open https://api.slack.com/apps → **Create New App** → **From scratch**.
2. App name: `TMMT Notifier`. Workspace: `projectaixmos`. **Create App**.
3. Sidebar → **Incoming Webhooks** → toggle **Activate Incoming Webhooks** on.
4. Scroll down → **Add New Webhook to Workspace** → pick `#sales` (or `#ops` — wherever you want the pings).
5. Copy the webhook URL. It starts with `https://hooks.slack.com/services/T...`.
6. Save it locally for step 4 — do not commit it anywhere.

---

## Step 2 — Telegram (2 min, manual mobile/desktop)

You need a bot token and your chat ID.

1. Open Telegram → search **@BotFather** → start chat.
2. Send `/newbot`. Name: `TMMT Notifier`. Username: something unique ending in `bot`, e.g. `tmmt_notifier_bot`.
3. BotFather replies with the token (`123456789:ABC-DEF...`). Copy it.
4. Now get your chat ID: search **@userinfobot** → start chat → send `/start` → it replies with your ID (a number). Copy it.
5. Last thing — send any message to your new bot (e.g. open the bot's profile, click "Start"). This is required before the bot can send you messages. One-time only.

---

## Step 3 — iMessage (DEFERRED — architecturally mismatched for Vercel)

> **Why deferred:** per memory `[[imessage-relay-live]]`, the iMessage relay is intentionally **manual-only** on the work Mac (M1 Max). Owner directive: relay only runs when `aix-relay on` is invoked before a batch of sends, and is turned off after. A Vercel-driven webhook needs a persistent listener — that's the opposite of the design intent.
>
> The carry Mac (M5 Pro / `100.77.126.8`) is deliberately OFF and the relay code is archived under `~/.archived-2026-06-08/imessage-relay/`. The work-Mac install bundle is staged on CYBORG but has not been run yet.
>
> **For now: rely on Slack + Telegram for handoff pings.** Both reach your phone via push notifications. They're the right channel for an automated webhook anyway — push is the standard, iMessage from Vercel would be unusual.
>
> If you ever want to wire iMessage anyway:
>
> 1. Install the relay on the work Mac (CYBORG bundle).
> 2. Decide whether the relay should run 24/7 (revisit the manual-only directive).
> 3. Expose the work Mac's tailnet address via Cloudflare Tunnel — `setup-brainiac-tunnel.ps1` in this folder is a template but needs the host changed from `localhost:8787` to the work Mac's tailnet IP.
> 4. Set `IMESSAGE_RELAY_URL`, `IMESSAGE_NOTIFY_TO`, `IMESSAGE_RELAY_TOKEN` in Vercel.
>
> The notification code in `src/lib/notify.ts` is already written and env-gated — turn it on by setting the env vars whenever the infra catches up.

---

## Step 4 — Wire Vercel and redeploy (1 min, on this Mac)

On your Mac, in this repo, run `set-vercel-notify-env.sh` (in this folder).

It accepts the values as args or env vars and uses `vercel env add` to set them on the `tmmt-ops` project for `production`, `preview`, and `development` scopes — then triggers a redeploy.

```sh
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
TELEGRAM_BOT_TOKEN="123456:ABC..." \
TELEGRAM_OWNER_CHAT_ID="123456789" \
./scripts/phase9-notify/set-vercel-notify-env.sh
```

Leave any variable blank to skip wiring that channel. iMessage vars are accepted by the script (`IMESSAGE_RELAY_URL`, `IMESSAGE_NOTIFY_TO`, `IMESSAGE_RELAY_TOKEN`) if you ever wire it later.

---

## Step 5 — Smoke test (1 min)

Run `smoke-test-handoff.sh` after the deploy goes green. It does a synthetic insert with `operator_handoff_requested=true` via the public form's anon client, and prints whether the row landed.

```sh
./scripts/phase9-notify/smoke-test-handoff.sh
```

Then watch Slack / Telegram / iMessage for the ping. Should arrive within ~5 seconds.

If a channel didn't fire: `vercel logs tmmt-ops --since=10m | grep notify` to see which one failed and why.

---

## Upgrading to a named tunnel (optional, prod-grade)

The ephemeral quick tunnel URL changes whenever `cloudflared` restarts. For a permanent URL you must:

1. Have a Cloudflare account with a domain on it.
2. On BRAINIAC: `cloudflared tunnel login` → opens browser → authorize.
3. `cloudflared tunnel create tmmt-imessage` → emits tunnel UUID.
4. `cloudflared tunnel route dns tmmt-imessage imessage.yourdomain.com` → creates CNAME.
5. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <uuid-from-step-3>
   credentials-file: C:\Users\<you>\.cloudflared\<uuid>.json
   ingress:
     - hostname: imessage.yourdomain.com
       service: http://localhost:8787
     - service: http_status:404
   ```
6. `cloudflared service install` → registers as a Windows service that survives reboots.
7. Update Vercel: `IMESSAGE_RELAY_URL=https://imessage.yourdomain.com/send`.

That URL never changes. The service auto-restarts on boot.

---

## Channels at a glance

| Channel | Env vars | Vercel-ready | Failure mode |
|---|---|---|---|
| Slack | `SLACK_WEBHOOK_URL` | Yes | Skipped if env unset; logged + ignored on HTTP error |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID` | Yes | Skipped if either unset; logged + ignored on HTTP error |
| iMessage | `IMESSAGE_RELAY_URL`, `IMESSAGE_NOTIFY_TO`, `IMESSAGE_RELAY_TOKEN` (optional) | Only with tunnel | Skipped if URL or TO unset; logged + ignored on HTTP error |

Form submission **never** blocks on notification delivery. Each channel times out independently after 5s. One channel failing doesn't affect the others.
