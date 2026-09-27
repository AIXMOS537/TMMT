# 08 — Integrations: what actually works

Source: SPEC §4.1, §11, §16, §17, §19.2 (+ E1 §1, §4, §7; E3 §3; E4 §1, §4, §5; E5 §B.1) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = the whole integration table, "Crons and automations" and "Local endpoints" (master + prod + off-repo jobs as observed). **TARGET** = the "Rules" section's gated outbox (PM-18, GHL M8) and per-org connections (GHL M3). Nothing customer-facing sends today.

Env var **names** are listed in E1 §4. Values are never printed. `src/lib/env-example.test.ts` enforces that every `process.env.X` appears in `.env.example`.

| Integration | Where | What works | What does not |
|---|---|---|---|
| **Stripe** | `POST /api/agent/stripe/webhook/[slug]` only; per-tenant `STRIPE_WEBHOOK_SECRET_<SLUG>` | Signature verification (`constructEvent`); replay gate on `audit_events`; on `payment_intent.succeeded` it sets `incoming_leads.agent_status='CLOSED'` + an audit row | **Writes no money row.** Nothing creates PaymentIntents / Checkout Sessions. `stripe_payment_intent_id` null on 892/892; org Stripe columns null on 9/9. No refunds, failures or disputes. EXISTING/PARTIAL (receiver only, never fed) |
| **GHL checkout links** | `NEXT_PUBLIC_GHL_CHECKOUT_*`, `src/lib/ghl-offers.ts` | How money is actually taken today | No proof of payment reaches TMMT |
| **GHL payment sync** | `src/lib/ghl-payment-sync.ts` via `api/webhooks/ghl` | **CODE CAPABILITY:** can insert `customer_payments` (incl. `Paid`) from a tag/event (V2) | **PRODUCTION OBSERVATION:** 0 GHL-sourced rows; never fired. Neither "GHL does not create payments" nor "GHL is creating payments" is true |
| **Twilio** | `api/agent/sms/inbound` (HMAC, fails closed), `lib/agent/twilio-send.ts` | Inbound SMS agent code is correct | **0 of 9 orgs have `twilio_inbound_number`** → EXISTING/BROKEN (config). `sendSms` has 0 callers (ORPHANED) |
| **Email** | `src/lib/email/send.ts` | Gate + `EMAIL_LIVE=1` + `ownerApproved` | `sendEmail` has 0 callers; the fallback `.outbox/email-outbox.jsonl` is unusable on Vercel |
| **Sentry** | `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation*.ts` | Errors captured | **No `beforeSend` PII scrubber**; the `withSentryConfig` root import is deprecated (`next.config.ts:4`) |
| **Mixpanel** | browser, `NEXT_PUBLIC_MIXPANEL_TOKEN` | Loaded | Not audited further |
| **Anthropic** | `src/lib/agent/llm-router.ts`, `src/lib/ops-ai.ts` | Reachable from Vercel. Ops AI fails safe (`ai_aligned=false` without a model) | – |
| **Pocket brain** (LiteLLM/Ollama) | `src/lib/pocket-brain.ts`, `/api/pocket/chat` | Works with a public `POCKET_BRAIN_URL` | 503 on Vercel when unset (tailnet URL) |
| **Captain** (dispatch ranking) | `src/lib/captain-client.ts` (`AIXMOS_AGENT_HOST`, default `127.0.0.1:7777`) | Falls back to the first candidate | AI never runs on Vercel |
| **Slack / Telegram / iMessage** | `src/lib/notify.ts` (`fanOut`), `agent/handoff.ts`, `notify-telegram.ts` | Internal owner/staff notifications. Slack leg works | **Un-awaited in server actions** (FS-06). The iMessage relay is tailnet-only and skipped silently |
| **Telegram mission** | `/api/mission/generate` via GitHub `mission-daily.yml` | – | 307'd by middleware; the job shows green anyway (FS-17). **Latent team broadcast** (`audience=team`, `notify=true`) |
| **M1 GHL poller** | off-repo launchd `com.tmmt.ghl-supabase-sync` every 6 h → `ghl_contacts` → trigger `promote_ghl_contact` → `incoming_leads` | **The only live lead feed** (`ghl_contacts` 1,656, synced 2026-09-21) | Not in the repo; 5,000-contact cap with silent truncation (FS-15); `promote_ghl_contact` swallows errors (FS-14) |
| **n8n** (`tmmt-n8n`) | BRAINIAC Docker | – | ABANDONED; the reason `automation_outbox` has no drainer |
| **Supabase edge functions** | 7 deployed; 1 in repo (`supabase/functions/intake`) | – | `intake` v7 deployed with `verify_jwt=false`, caller-chosen tenant (CRITICAL per registry; GHL B-4). `capture-drive` (not in repo; B-5). `handoff-slack-notify`, `operator-checkin`, `operator-provision`, `blast-operators`, `provision-on-payment` are not in the repo; activity UNKNOWN |
| **Cal.com** | `api/agent/cal/webhook/[slug]` (HMAC, replay gate) | Receiver works | `cal_com_event_link` null on 9/9 orgs |
| **ClickUp** | `src/lib/clickup` (0 tests) | Partial | `clickup_tasks` 0 |
| **Airtable** | `/api/webhooks/airtable*`, `scripts/sync-airtable.mjs` | LEGACY | The legacy verified webhook can re-enter V1 (`api/webhooks/airtable/route.ts:135`). The sync script is a delete-all (locked, D5). Retire after SoR §6 step 3 |
| **GHL** | see `09_GHL.md` | one env token, one location | N-org = GHL track |

## Crons and automations

- **pg_cron (10, active):** `agent-wp-reap` (every min), `leadnet-sla-sweep` (*/15), `rebalance_all_orgs` (*/30), `aixmos_daily_va_sweep` / `_classify` / `_edge_brief` (12:00/12:15/12:20), `aixmos_nightly_journey_recompute` (04:30), `leadnet-daily-digest` (13:00), `sweep-overdue-payments` (13:00), `sweep-payment-due-notices` (13:05, writes the outbox with no DNC reference).
- **Vercel crons (2; PRODUCTION DEPLOYMENT STATE: their handlers do not run):** the auth middleware intercepts `/api/cron/*` and redirects to `/login` (`src/middleware.test.ts:237` pins it), so `/api/cron/marketing-kpi-ghl` (Mon 13:00; `marketing_kpi_weeks` last written 2026-05-20) and `/api/cron/journey-recompute` (04:00; **duplicates** the pg_cron job at 04:30) never execute. Both accept `Authorization: Bearer $CRON_SECRET` (fallback `OPS_COMMAND_SECRET`) or `x-cron-secret` and answer 401 without it (`src/app/api/cron/*/route.ts`). **Fixing the middleware is not a one-line repair:** it re-arms `mission-daily`'s dormant team broadcast unless TMMT-SEC-005 lands first, it makes the journey recompute run twice until TMMT-BUILD-006 lands, and `/api/license/*` cannot be opened without a credential + rate limit (SPEC §6.3, §17).
- **Triggers:** 8 on `incoming_leads` (including `lead_to_active_customer_trg` and `on_new_lead_trg` → outbox), 2 on `intake_events`, 2 on `ghl_contacts` (`trg_promote_ghl_contact`), and 2 on `cases` (a **duplicate** status history: 12 rows for 4 cases).
- **Dormant / abandoned:** `agent_jobs` spine (a local worker, dormant since 09-16), n8n.
- **GitHub:** `verify.yml` (the real CI), `pii-guard.yml` (vacuous if `PII_DENYLIST` is unset), `mission-daily.yml` (dead-green, latent send), `session-autopilot.yml` (latent auto-merge / branch delete).
- **Windows:** `TMMT-Watchdog` restarts the **retired** TMMT OS on :3000 (2A-A11).

## Local endpoints unreachable from Vercel

`POCKET_BRAIN_URL` (tailnet), `AIXMOS_AGENT_HOST` (`127.0.0.1:7777`), the iMessage relay (100.x), the agent-spine worker (model `rick` on BRAINIAC/M1) and `aria` (Ollama `127.0.0.1:11434`). On Vercel these silently degrade. **No customer-facing feature may depend on them** (PM-15 exit).

## Rules

- **Queued ≠ delivered.** `automation_outbox` has 35 `queued` rows and 0 `sent`; no customer-facing delivery path has ever functioned. A queue row is never evidence that messaging works.
- Customer-facing sends go only through the gated outbox (PM-18), never through a direct call to `sendSms` / `sendConversationMessage` / `sendEmail`.
- Every integration write must check its result. No `void` on a side effect whose loss matters.
- Per-tenant secrets use the templated `…_<SLUG>` pattern. Unset = 401.
