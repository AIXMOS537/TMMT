# TMMT-COMM-001

## TASK ID
TMMT-COMM-001

## TITLE
The outbox drainer: a cloud-hosted, secret-gated, idempotent job that claims `automation_outbox` rows and hands them to the gated senders — shipped in **dry-run** mode, with no send until the owner switches it on

## PM MILESTONE
PM-18 Communications gateway (roadmap new-build item 1: "The drainer (a cloud-hosted job, not n8n on a laptop)"; consumes the GHL M8 outbox design)

## OBJECTIVE
Give the queue a consumer that runs on Vercel, claims each row exactly once, runs the consent gate at send time (TMMT-COMM-002), calls one sender per channel, and writes the result back. Until the owner flips the switch it only logs what it *would* send.

## WHY (evidence refs)
- SPEC §5.9, §16 ("`automation_outbox` PLACEHOLDER: 35 rows queued 08-29 → 09-18, `sent_at` never set, no drainer (n8n abandoned)"), §24 **FS-16**, §28 **KD-22**, §31.1 (Communications acceptance), §32 #12; READINESS §4 #4, §10.4 #6; ROADMAP PM-18 (exit: "The drainer is idempotent under retry"; "The first customer send is switched on only by an owner decision with the baton"); E4 §4 (fed by DB `on_new_lead`, `sweep_payment_due_notices`; app stager `src/lib/ops/va-task-outbox.ts`; only `outbox/actions.ts`, `outbox/page.tsx`, `va-task-outbox.ts` touch it).

## CURRENT BEHAVIOR (file:line)
- `automation_outbox`: 35 rows, all `notify-new-lead` / email / `queued`; `sent_at` never set (E4 §4). **Columns must be read from the prod catalog / snapshot** (channel, recipient, body, status, `sent_at`, attempts, org…): do not guess them.
- Producers: trigger `on_new_lead_trg` (E4 §5), pg_cron `sweep-payment-due-notices` 13:05 (writes without a DNC reference), app stager `stageVaTaskMessages` (`src/lib/ops/va-task-outbox.ts`; `(command)/command/outbox/actions.ts:37,59`) which runs `assertOutboundAllowed` at **stage** time.
- Senders (all 0 callers): `sendSms` (`src/lib/agent/twilio-send.ts:39`, gated `:46`), `sendConversationMessage` (`src/lib/ghl/client.ts:280`, SMS-only gate `:299`, silent return `:310-311`), `sendEmail` (`src/lib/email/send.ts:134`; `EMAIL_LIVE=1` + `ownerApproved`; filesystem fallback unusable on Vercel).
- Vercel crons are 307'd until TMMT-BUILD-001; `CRON_SECRET ?? OPS_COMMAND_SECRET` pattern in `src/app/api/cron/*/route.ts`.
- GHL M8 (branch, design only: "docs(m6) outbox prep") owns the outbox **design**; this lane owns the drainer operation (ROADMAP PM-18 owner note).

## EXPECTED BEHAVIOR
- Route `POST /api/cron/outbox-drain` (same secret pattern as the other crons; 401 without), plus a `vercel.json` cron entry (staged in the PR; the owner decides the schedule when switching on).
- Claim step: a staged SECURITY DEFINER RPC `outbox_claim_batch(p_limit int)` that atomically moves up to N `queued` rows past their `send_after` (if such a column exists) to `sending` with a `claimed_at`/`claim_token`, using `FOR UPDATE SKIP LOCKED`; a second concurrent call gets different rows. Rows stuck in `sending` longer than T are re-queued by the same RPC with `attempts+1`, up to a max, then `dead`.
- Per row: consent gate (TMMT-COMM-002; until it lands, the drainer calls `assertOutboundAllowed` itself and refuses email rows because the email DNC table is a ghost — fail closed), owner-hold check (row must carry an approval mark where policy requires; the `/command/outbox` stager already sets `ownerApproved`), then the channel sender, then write-back (`sent_at`, provider message id, `delivery_status='sent'|'failed'|'blocked'`, error class, no PII in the error).
- **Dry run by default:** env `OUTBOX_DRAIN_MODE` ∈ `dry|live`, default `dry` when unset. In `dry`, the drainer claims, gates, logs `would_send` (channel, org, row id, outcome) and writes `delivery_status='dry_run'`, releasing the row back to `queued` **or** marking `dry_run` per owner choice (default: mark `dry_run` so the 35 legacy rows stop looking "queued"; see TMMT-COMM-004 triage first).
- Structured, PII-free logs; every write's result checked (FS rule).

## FILES (in scope)
- NEW `src/app/api/cron/outbox-drain/route.ts` (+ test), NEW `src/lib/comms/drainer.ts` (+ test), NEW `src/lib/comms/senders.ts` (adapters over the three existing senders; no new provider calls)
- NEW `supabase/migrations/_staged/<ts>_outbox_claim_STAGED.sql` (+ `scripts/tests/sql/outbox-claim.rehearsal.mjs`)
- `vercel.json` (cron entry, staged in PR; owner applies)
- `.env.example` (`OUTBOX_DRAIN_MODE`, `env-example.test.ts` enforces it)

## DATABASE ENTITIES
`automation_outbox` (claim/status columns — add via the staged migration **only** the ones the snapshot shows are missing: `claimed_at`, `claim_token`, `attempts`, `delivery_status`, `provider_message_id`, `last_error_class`); NEW RPC `outbox_claim_batch`. Read: `do_not_contact_numbers`, `incoming_leads.opted_out`.

## DEPENDENCIES
- **GHL M8 outbox design** (`wt-ghl-m5m6` docs): read it first; column names and status vocabulary must match it, or the difference is recorded and agreed with the GHL owner. Do not fork the design.
- **TMMT-BUILD-001** (crons reachable). **TMMT-SEC-003** (DNC on GHL writes) landed.
- **TMMT-COMM-002** (consent at send) — may land together; the drainer must never send without it.
- TMMT-COMM-004 (triage of the 35 rows) before the first `live` run.
- G-02 (draft PR #243 `comms/g02-internal-destinations`): internal vs customer separation; align the `channel`/`audience` field with it.

## CONSTRAINTS
- **No send in this PR.** `live` mode is an owner switch with the baton; the PR must not set it anywhere.
- No n8n, no local worker. Vercel only.
- One sender per channel; no new provider SDKs.
- Batch size and schedule are constants with owner-visible defaults (e.g. 20 rows, every 5 min).

## SECURITY REQUIREMENTS
- Secret-gated route; 401 without; a session cookie is not a substitute (test).
- Service role only inside the drainer; the RPC is `REVOKE`d from anon/authenticated.
- Consent gate **fails closed** on any read error or unknown phone; email rows are refused until a real email DNC exists.
- No message bodies or phone numbers in logs; ids only.
- Idempotency: a retry after a crash cannot double-send (claim token + provider idempotency key where the provider supports it).

## IMPLEMENTATION NOTES
- Pattern the claim RPC on `agent_jobs` (`agent-wp-reap`, worker RPCs revoked from anon/authenticated, E5 §B.2 #11).
- Keep `senders.ts` thin: it should be trivial for GHL M8 to swap the GHL adapter for `GhlGateway`.

## ACCEPTANCE CRITERIA (testable)
1. Two concurrent `outbox_claim_batch` calls never return the same row (rehearsal).
2. A crashed claim (stale `sending`) is re-queued once and dead-lettered at the max (rehearsal).
3. In `dry` mode no sender is called (fetch/Twilio mocks assert 0 calls) and rows get `dry_run` status.
4. A DNC/opted-out row is `blocked`, never sent, in both modes.
5. Route: 401 without secret; 401 with a session cookie only.
6. Every write result is checked (no `void`); full gate passes; `OUTBOX_DRAIN_MODE` documented in `.env.example`.

## TESTS (must fail on the pre-fix code)
- `outbox-claim.rehearsal.mjs`: `concurrent claims disjoint`, `stale sending requeued then dead`, `anon/authenticated cannot execute` (pre-migration: RPC missing).
- `drainer.test.ts`: `dry mode never calls a sender`, `blocked on DNC`, `email refused while DNC-email table absent`, `write-back on failure`.
- `route.test.ts`: `401 without secret`, `session cookie is not a credential`.

## DO NOT CHANGE
- `assertOutboundAllowed` semantics; `va-task-outbox.ts` staging rules; the three senders' gates; `on_new_lead` / `sweep_payment_due_notices` bodies (TMMT-COMM-004); GHL webhook files; prod.

## OWNER GATE
**Owner + prod baton** for: the staged migration, the cron entry, and any move to `OUTBOX_DRAIN_MODE=live` (a live-communication switch-on). Code merge: owner + baton.
