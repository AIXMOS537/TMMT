# TMMT-PAY-002

## TASK ID
TMMT-PAY-002

## TITLE
Replace the date-only `sweep_overdue_payments` with a ledger-based rule: Overdue only when a due obligation has no verified payment (staged, rehearsed, not applied)

## PM MILESTONE
PM-06 Payments (roadmap new-build: "Replace the date-only overdue sweep with a ledger-based one"; READINESS §7 "Overdue sweep → based on the ledger, not the date")

## OBJECTIVE
Stop stamping people Overdue because a date passed. Overdue means: an obligation was due and no verified payment covers it.

## WHY (evidence refs)
- SPEC §10.5 #5, §11.5 (two overdue definitions, V6), §24 **FS-23**, §28 **KD-20**; E3 §2 #6 (cron 13:00 sets Overdue when `next_payment_due_date <= today` regardless; cause of 25/31), §3.5.

## CURRENT BEHAVIOR (file:line)
- pg_cron `sweep-overdue-payments` (13:00) → function (name from `cron.job`) updates `customer_payments.payment_status='Overdue'` by date (body captured read-only).
- "Paid" = text status, set by staff click / GHL / Airtable; `payment_obligation_reconciliation` has 0 verified rows.
- GHL `/overdue` webhook tags `payment-overdue` separately (V6).

## EXPECTED BEHAVIOR
- Staged `CREATE OR REPLACE` of the sweep function: mark `Overdue` only when `next_payment_due_date <= today` **and** no verified reconciliation row (`payment_obligation_reconciliation.state='verified'` with `verified_by` + `evidence_ref`) covers the obligation; otherwise leave the status alone; never move `Paid` to `Overdue`. Write an `audit_events` row per change (no PII). Until TMMT-PAY-001 defines the money table, "verified" = the reconciliation row (the only evidence structure today).
- A dry-run mode (`p_dry_run boolean default true`) returning the would-change counts, for the owner to run first.
- No change to the 25 existing Overdue rows in this task (a separate owner-run correction after PAY-001).

## FILES (in scope)
NEW `_staged/<ts>_overdue_sweep_ledger_based_STAGED.sql`; NEW `scripts/tests/sql/overdue-sweep.rehearsal.mjs` + fixture DDL (captured function; no rows).

## DATABASE ENTITIES
Function behind `sweep-overdue-payments`; read `customer_payments`, `payment_obligation_reconciliation`; write `audit_events`.

## DEPENDENCIES
Read-only catalog capture (or TMMT-BUILD-003). TMMT-PAY-001 recommended first (so the rule matches the chosen money model); the interim rule above is safe either way.

## CONSTRAINTS
Staged; not applied. Do not touch the GHL overdue webhook (V6 resolution belongs to PAY-001 / GHL M8).

## SECURITY REQUIREMENTS
Rehearsal: the function is `REVOKE`d from anon/authenticated; only cron/service_role executes.

## IMPLEMENTATION NOTES
Keep the old body in a comment block as rollback.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal pre-migration: a due obligation with a verified reconciliation row is stamped Overdue (the bug).
2. Post-migration: it is not; an unverified due obligation is; `Paid` never becomes Overdue; dry-run changes nothing and returns counts.
3. Idempotent; runbook with postcondition counts.

## TESTS (must fail on the pre-fix code)
`overdue-sweep.rehearsal.mjs`: `verified obligation not marked overdue` (fails pre-migration); `unverified due marked`; `paid never overdue`; `dry run no-op`.

## DO NOT CHANGE
`customer_payments` rows; the reconciliation CHECK; GHL overdue route; prod.

## OWNER GATE
**Prod baton** (owner applies; runs dry-run first).
