# Mission Control — Daily Push (Owner + Team)

Companion to the in-app `MissionBoard` panel (`src/components/mission/mission-board.tsx`). Pushes the same role-scoped mission summary to the owner's Telegram chat (and optionally every teammate with a chat_id) on demand or daily by cron.

## What's wired

- `src/lib/mission/render-telegram.ts` — converts `MissionBoardData` to a Telegram-friendly text body. Tone-aware unicode dots, hard-capped at 4 000 chars.
- `src/lib/mission/fan-out.ts` — pure `fanOutMissionToChats(chatIds, text, sendOne)` helper. No `server-only` import — directly unit-testable.
- `src/lib/mission/send.ts` — `sendOwnerMissionToTelegram` + `sendMissionToTeam`. Build dashboard, render, send to owner chat OR query `public.profiles` for every chat_id and fan out concurrently.
- `src/app/api/mission/generate/route.ts` — REST surface.
  - `GET` — for crons. Defaults `notify=true`, `audience=owner`.
  - `POST` — for manual smoke. Defaults `notify=false` (safe dry-run); `audience=owner`. Pass `{"notify":true,"audience":"team"}` for the real team-wide send.
  - Auth: `Authorization: Bearer ${CRON_SECRET}` **or** `x-cron-secret: ${CRON_SECRET}` **or** `x-mission-secret: ${CRON_SECRET}`. Falls back to `OPS_COMMAND_SECRET` if `CRON_SECRET` is unset.
- `.github/workflows/mission-daily.yml` — **the free Vercel-Pro-cron replacement.** GitHub Actions schedule fires daily at 13:00 UTC (8 AM ET) and hits the endpoint with `audience=team, notify=true`. Manual `workflow_dispatch` trigger for fire-now testing from the Actions tab.

## Env vars (production)

Three secrets — all reused from existing systems, **no new ones introduced**:

| Var | Purpose | Already in use by |
|---|---|---|
| `CRON_SECRET` | Auth for `/api/mission/generate` and existing cron routes | `journey-recompute`, `marketing-kpi-ghl` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token | Dispatch responder pings (`notify-telegram.ts`) |
| `TELEGRAM_OWNER_CHAT_ID` | Owner's chat (used only when `audience=owner`) | Dispatch fallback ping (`notify.ts`) |
| `MISSION_GREETING_NAME` *(optional)* | First-line greeting; defaults to `"Owner"` | — |

Fail-closed: missing `CRON_SECRET` → 401. Fail-soft: missing `TELEGRAM_OWNER_CHAT_ID` with `audience=owner, notify=true` → 200 with `notified=false`.

## Recommended setup — free, no Vercel Pro

GitHub Actions does the cron. Vercel just hosts the endpoint. Two one-time commands:

```bash
# 1. Same CRON_SECRET that's already on Vercel — let GitHub Actions present it
gh secret set CRON_SECRET --repo AIXMOS537/TMMT --body "$(vercel env pull /dev/stdout 2>/dev/null | grep ^CRON_SECRET= | cut -d= -f2-)"

# 2. (Optional) Override the target if you ever rename the prod URL
# gh secret set MISSION_API_BASE --repo AIXMOS537/TMMT --body "https://tmmt-ops.vercel.app"
```

That's it. The workflow runs daily at 13:00 UTC and can also be fired on demand from the Actions tab.

## Manual smoke test

Dry-run (build only, no Telegram send):

```bash
curl -s -X POST https://tmmt-ops.vercel.app/api/mission/generate \
  -H "x-mission-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"notify":false,"audience":"owner"}' | jq .
# expect: { ok:true, audience:"owner", built:true, notified:false, reason:"notify=false", chars:N, preview:"..." }
```

Real team-wide send:

```bash
curl -s -X POST https://tmmt-ops.vercel.app/api/mission/generate \
  -H "x-mission-secret: $CRON_SECRET" \
  -d '{"notify":true,"audience":"team"}' | jq .
# expect: { ok:true, audience:"team", built:true, recipients:N, sent:N, failed:0, chars:N }
```

## Onboarding a teammate (until the `/start` webhook lands)

The `telegram_chat_id` column already exists on `public.profiles` (added by `20260530120000_rescue_dispatch_core.sql`). To enroll someone:

1. They DM `@userinfobot` on Telegram → it replies with their numeric `chat_id`
2. They DM `@<TMMT_BOT>` once (so the bot is allowed to message them — Telegram bots can only message users who started the conversation)
3. Owner pastes the chat_id into their profile via the existing dispatch responders UI (which already shows `TG ✓` / `TG ✗` per `src/app/(command)/dispatch/responders/RespondersClient.tsx`)

Once their chat_id is set, they're included in the next team-wide push.

## Alternative: Vercel cron (if Pro is on the roadmap)

`vercel.json` is **deliberately unchanged** in this PR. If `tmmt-ops` upgrades to Pro later, append this entry to `vercel.json` `"crons"` and disable the GH Actions workflow:

```json
{ "path": "/api/mission/generate", "schedule": "0 13 * * *" }
```

Vercel automatically signs Bearer auth on cron requests when `CRON_SECRET` is a project env var.

## What's NOT in this PR

- **Per-role mission variants.** All recipients currently get the owner view. `buildManagerMissionData`, `buildTeamMissionData`, etc. are a follow-up Spec.
- **Telegram bot `/start` webhook for automated chat_id capture.** Onboarding is manual via `@userinfobot` (see above).
- **DB migration.** None needed — `telegram_chat_id` exists already.
