# TMMT-OPS-002

## TASK ID
TMMT-OPS-002

## TITLE
Automation health screen on the admin console: pg_cron and Vercel cron last success, GHL poller staleness (> 7 h or truncation), webhook health, outbox age, baton status

## PM MILESTONE
PM-17 Production hardening (roadmap: "Health screen: crons, the live GHL feed (7 h staleness + truncation alert until M5/M6 retire the poller), webhooks, outbox age, money reconciliation"; SPEC §23.3, §26)

## OBJECTIVE
The owner can see, on one page, whether the machines that feed TMMT are alive, before a silent failure costs leads or money.

## WHY (evidence refs)
- SPEC §17 (KPI cron dead since 2026-05-20; M1 poller 5,000 cap), §23.3 ("Security / health: none"), §23.4 (Automation health widget = NEW BUILD on existing data), §24 **FS-15**, **FS-16**, **FS-17**, §26, §28 **KD-33**; READINESS §5 #13; E4 §5 (`cron.job_run_details` 7-day history; `ghl_contacts.synced_at`; `ghl_webhook_events` 0; `sync_events` 27 unprocessed).

## CURRENT BEHAVIOR (file:line)
No health page. `ops.prod_baton_status()` exists. `cron.job_run_details` readable by service role only.

## EXPECTED BEHAVIOR
- `/command/health` (owner-only) with tiles: each pg_cron job (last success/failure from `cron.job_run_details` via a staged SECURITY DEFINER RPC `ops_health_snapshot()` `REVOKE`d from anon/authenticated, owner via `is_platform_admin()`), Vercel crons (last 2xx recorded by the routes into `audit_events` — add a one-line audit write to each cron route), GHL poller (`max(synced_at)` age; count vs the 5,000 cap), webhooks (`ghl_webhook_events` count/last, `sync_events` unprocessed), outbox (queued count, oldest age, dead count), baton status. Thresholds highlight: poller > 7 h, outbox oldest > 24 h, cron missed.
- Read-only; four states; no PII (counts/timestamps only).
- Alerts (Slack/Telegram internal) are a follow-up; this task is the screen.

## FILES (in scope)
NEW page + queries (+ tests), staged RPC + rehearsal, two cron routes (audit write), `command-hub-nav.ts` link; route registry row.

## DATABASE ENTITIES
NEW RPC `ops_health_snapshot`; read `cron.job_run_details`, `ghl_contacts`, `ghl_webhook_events`, `sync_events`, `automation_outbox`, `audit_events`, `ops.*` baton.

## DEPENDENCIES
TMMT-BUILD-001 (crons reachable), TMMT-COMM-001 (outbox statuses). Coordinate with GHL M5/M6 (poller retirement changes the tile).

## CONSTRAINTS
No writes except the cron audit lines. No external calls.

## SECURITY REQUIREMENTS
Owner-only page and RPC; hostile authenticated and staff refused (test + rehearsal).

## IMPLEMENTATION NOTES
Keep the RPC's SELECT list explicit; never expose job commands (they can embed literals).

## ACCEPTANCE CRITERIA (testable)
1. Owner sees every pg_cron job with last-run status (rehearsal fixture).
2. Staff/hostile → 307/denied.
3. Poller age > 7 h renders the warning state (unit test).
4. Full gate passes.

## TESTS (must fail on the pre-fix code)
Rehearsal: `ops_health_snapshot owner-only`; unit: threshold rendering; route: owner-only.

## DO NOT CHANGE
Cron jobs themselves; the poller; prod.

## OWNER GATE
Prod baton (RPC). Merge = deploy: owner + baton.
