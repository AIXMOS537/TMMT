# TMMT-COMM-004

## TASK ID
TMMT-COMM-004

## TITLE
DNC/opt-out checks in the DB enqueue paths (`on_new_lead`, `sweep_payment_due_notices`) and a triage of the 35 stuck `automation_outbox` rows (staged; never blast)

## PM MILESTONE
PM-18 Communications gateway (roadmap new-build item: "DNC checks added to `on_new_lead` and `sweep_payment_due_notices` enqueue paths"; existing foundation note "35 stuck rows to triage, not blast")

## OBJECTIVE
Rows that should never be sent are never queued, and the legacy backlog is closed out deliberately before any drainer runs live.

## WHY (evidence refs)
- SPEC §16 ("DB `on_new_lead` and `sweep_payment_due_notices` enqueue without a DNC reference"), §17 (`sweep-payment-due-notices` 13:05: "outbox, no DNC, no drainer"), §28 **KD-22**, §21.1 (Consent gaps); ROADMAP PM-18; E4 §2(c) (prosrc scan: no DNC/opt-out reference in either body), §4 (35 rows, `notify-new-lead`/email/`queued`, 2026-08-29 → 09-18).
- The landmine `_staged/20260904010000_generate_va_tasks_idempotent_STAGED.sql` shows what "strip the DNC filter" looks like; this task does the opposite and must not touch that file.

## CURRENT BEHAVIOR (file:line)
- Prod trigger `on_new_lead_trg` on `incoming_leads` → function `on_new_lead()` inserts an `automation_outbox` row per new lead (body from the catalog; no repo file).
- pg_cron `sweep-payment-due-notices` (13:05) → function (name from `cron.job`) queues "payment due today" rows (E3 §3.4, E4 §5).
- `promote_ghl_contact` and `generate_va_tasks_v2` **do** check DNC and opt-out (E4 §4) — the pattern to copy.
- 35 `queued` rows exist; the drainer (TMMT-COMM-001) would otherwise process them on its first live run.

## EXPECTED BEHAVIOR
- Staged migration `_staged/<ts>_outbox_enqueue_dnc_STAGED.sql`: `CREATE OR REPLACE` of both functions (bodies captured read-only from the prod catalog, then minimally edited) adding: skip when the phone (E.164-normalised as the existing functions do) is in `do_not_contact_numbers`, when `incoming_leads.opted_out`, or when no phone/email can be resolved; write a `blocked` outbox row **or** nothing (owner decision; default: write nothing and log to `audit_events` with reason, no PII). Idempotent; rollback = previous bodies (kept in the migration as a comment block).
- Note: the send-time gate (TMMT-COMM-002) still runs; this is defence in depth, not a replacement.
- **Triage plan (docs + a staged data migration the owner may run):** classify the 35 rows by kind and age; recommend `expired` (never send a "new lead" welcome three weeks late), with a query that marks them `expired`/`dry_run` and records the count; **no send**. The PR shows counts only.
- Rehearsal: fixture lead on DNC → no outbox row; opted-out → none; clear → one row; due-notice sweep skips DNC.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_outbox_enqueue_dnc_STAGED.sql`
- NEW `supabase/migrations/_staged/<ts>_outbox_backlog_triage_STAGED.sql` (data migration, owner-run)
- NEW `scripts/tests/sql/outbox-enqueue-dnc.rehearsal.mjs` + fixture DDL (functions captured, no rows)
- `docs/product/OUTBOX_BACKLOG_TRIAGE.md` (counts by kind/age; recommendation)

## DATABASE ENTITIES
Functions `on_new_lead()`, the due-notice sweep function; table `automation_outbox` (status only, via the owner-run triage); read: `do_not_contact_numbers`, `incoming_leads`, `customer_payments`.

## DEPENDENCIES
- Read-only catalog access to capture both function bodies (or TMMT-BUILD-003 snapshot). **STOP if unavailable.**
- Must land (be applied) **before** TMMT-COMM-001 goes `live`.
- Coordinate with GHL M8 (outbox status vocabulary: `expired`/`blocked` must match the design).

## CONSTRAINTS
- Never apply; never send; never delete rows.
- Do not touch `generate_va_tasks_v2` or the quarantine tables.
- Do not open the landmine file.

## SECURITY REQUIREMENTS
- Rehearsal proves DNC/opt-out rows never reach the outbox; the fixture uses synthetic numbers.
- The triage migration is idempotent and only moves `queued` rows older than a cutoff to `expired`.

## IMPLEMENTATION NOTES
- Copy the exact DNC/opt-out predicate from `promote_ghl_contact` (captured) so all three functions agree.
- Payment-due notices also need "mercy" wording review later (PM-06/PM-18 templates); not here.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal pre-migration: a DNC lead insert queues a row (demonstrates the gap).
2. Post-migration: DNC and opted-out leads queue nothing; clear leads queue one row; due-notice sweep skips DNC (fails pre-migration).
3. Migration twice = no-op; rollback bodies present.
4. Triage doc shows counts by kind/age and the owner query; the data migration marks only `queued` rows past the cutoff.
5. PR contains the owner runbook (pre-check, apply, postcondition counts).

## TESTS (must fail on the pre-fix code)
- `outbox-enqueue-dnc.rehearsal.mjs`: `DNC lead not queued` (fails pre-migration); `opted-out not queued`; `clear lead queued`; `due-notice sweep skips DNC`; `idempotent`.

## DO NOT CHANGE
- `promote_ghl_contact`, `generate_va_tasks_v2`, quarantine/remediation tables, the landmine file, prod.

## OWNER GATE
**Prod baton** for both staged migrations; owner decision on `expired` vs `dry_run` for the backlog.
