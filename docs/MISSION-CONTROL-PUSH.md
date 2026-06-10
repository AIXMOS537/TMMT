# Mission Control — Daily Push (Owner)

Companion to the in-app `MissionBoard` panel (`src/components/mission/mission-board.tsx`). Lets the owner receive the same role-scoped mission summary via Telegram, either on demand or daily by cron.

## What's wired

- `src/lib/mission/render-telegram.ts` — converts `MissionBoardData` to a Telegram-friendly text body. Tone-aware unicode dots, hard-capped at 4 000 chars.
- `src/lib/mission/send.ts` — `sendOwnerMissionToTelegram({ notify })` builds the owner view from `getDashboardData()` and (optionally) sends to `TELEGRAM_OWNER_CHAT_ID`.
- `src/app/api/mission/generate/route.ts` — REST surface.
  - `GET` — for Vercel cron. Defaults `notify=true`.
  - `POST` — for manual smoke. Defaults `notify=false` (safe dry-run); pass `{"notify":true}` to actually send.
  - Auth: `Authorization: Bearer ${CRON_SECRET}` **or** `x-cron-secret: ${CRON_SECRET}` **or** `x-mission-secret: ${CRON_SECRET}`. Falls back to `OPS_COMMAND_SECRET` if `CRON_SECRET` is unset.

## Env vars (production)

Three secrets — all reused from existing systems, **no new ones introduced**:

| Var | Purpose | Already in use by |
|---|---|---|
| `CRON_SECRET` | Auth for `/api/mission/generate` and existing cron routes | `journey-recompute`, `marketing-kpi-ghl` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token | Dispatch responder pings (`notify-telegram.ts`) |
| `TELEGRAM_OWNER_CHAT_ID` | Where to send the owner's daily mission | Dispatch fallback ping (`notify.ts`) |
| `MISSION_GREETING_NAME` *(optional)* | First-line greeting; defaults to `"Owner"` | — |

If `CRON_SECRET` is unset, the endpoint returns 401 — fail-closed. If `TELEGRAM_OWNER_CHAT_ID` is unset with `notify=true`, the endpoint returns 200 with `notified=false, reason="TELEGRAM_OWNER_CHAT_ID not set"` — fail-soft.

## Manual smoke test

Dry-run (build only, no Telegram send):

```bash
curl -s -X POST https://tmmt-ops.vercel.app/api/mission/generate \
  -H "x-mission-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"notify":false}' | jq .
# expect: { ok:true, built:true, notified:false, reason:"notify=false", chars:N, preview:"..." }
```

Real send:

```bash
curl -s -X POST https://tmmt-ops.vercel.app/api/mission/generate \
  -H "x-mission-secret: $CRON_SECRET" \
  -d '{"notify":true}' | jq .
# expect: { ok:true, built:true, notified:true, chars:N }
```

## Adding the cron — gated on Vercel plan

`vercel.json` is **deliberately unchanged** in this PR. Current production has 2 crons (`marketing-kpi-ghl`, `journey-recompute`). On Hobby that's the cap. Before adding a 3rd, **one of**:

1. Upgrade `tmmt-ops` to Vercel Pro (unlimited crons), or
2. Replace one of the existing crons in `vercel.json`.

Once confirmed, append this entry to `vercel.json` `"crons"`:

```json
{ "path": "/api/mission/generate", "schedule": "0 13 * * *" }
```

(`0 13 * * *` = daily 13:00 UTC = 8:00 AM ET in winter, 9:00 AM ET in summer. Adjust to taste.)

The cron will hit `GET /api/mission/generate` — auth via `Authorization: Bearer ${CRON_SECRET}` is added automatically by Vercel when `CRON_SECRET` is set as an env var on the project.

## What's NOT in this PR

- **Per-teammate fan-out.** Only the owner chat gets pushed. Per-role variants (`buildManagerMissionData`, etc.) and querying `profiles` for users with `telegram_chat_id` are deliberately deferred — the `telegram_chat_id` column already exists on `public.profiles` (added by `20260530120000_rescue_dispatch_core.sql`), so this is a follow-up PR without a migration.
- **Telegram bot webhook for `/start`.** Teammates capture their `chat_id` today by DM-ing `@userinfobot` and pasting into the dispatch responders page. Automated `/start` capture is a separate PR.
- **DB migration.** None needed for the owner-only push.
