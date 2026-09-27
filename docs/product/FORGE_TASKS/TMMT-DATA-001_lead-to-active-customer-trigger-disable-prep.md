# TMMT-DATA-001

## TASK ID
TMMT-DATA-001

## TITLE
Prepare and rehearse disabling the `lead_to_active_customer` trigger (staged; the owner applies with the baton)

## PM MILESTONE
PM-00 Security containment (roadmap item 00-g). It is a prerequisite of PM-05.

## OBJECTIVE
A free-text lead status edit (`'Contracting'`) must stop fabricating an "Active" rental row. **This task prepares and rehearses the change. It does not apply it.**

## WHY (evidence refs)
- SPEC §10.4, §10.5 #1, §28 **KD-07**, §21.1 (Active rental: VIOLATION); ROADMAP 00-g (prod baton), PM-05 depends on 00-g.
- E3 §2: when `incoming_leads.status` becomes `'Contracting'`, the trigger inserts `active_customers` with `status='Active'` (dedupe by email or name), with no booking, vehicle, contract or payment. `active_customers` is what the desk shows as customers.

## CURRENT BEHAVIOR (file:line)
- Prod: trigger `lead_to_active_customer_trg` on `public.incoming_leads` → function `public.lead_to_active_customer()` (E4 §5 lists it among the 8 `incoming_leads` triggers).
- Repo: **no `CREATE` of the function or the trigger** exists. Only `revoke execute on function public.lead_to_active_customer() from anon` in `supabase/migrations/20260903185639_audit_hardening_20260903.sql:16` (and the `_revoke_public` twin). The body must be captured from the prod catalog (`pg_get_functiondef`, `pg_get_triggerdef`), read-only.
- App: nothing in `src/` calls the function. The desk `/customers` reads `active_customers` (`src/app/(admin)/customers/page.tsx`).

## EXPECTED BEHAVIOR
- A staged migration `supabase/migrations/_staged/<ts>_disable_lead_to_active_customer_STAGED.sql`:
  - `ALTER TABLE public.incoming_leads DISABLE TRIGGER lead_to_active_customer_trg;` guarded so it is idempotent and a no-op if the trigger is absent;
  - **does not drop** the function or the trigger (a reversible first step; dropping is an OWNER DECISION later in PM-05);
  - includes a commented rollback (`ENABLE TRIGGER`).
- A PGlite rehearsal: a fixture with the prod-shaped function + trigger (captured, no data). Before the migration, setting `status='Contracting'` inserts an `active_customers` row. After it, no row is inserted. Other `incoming_leads` triggers in the fixture still fire.
- Owner runbook: pre-apply check (`select tgenabled from pg_trigger where tgname='lead_to_active_customer_trg'`), apply under the baton, postcondition (`tgenabled='D'`), rollback.
- A note in the PR on who relies on the fabricated rows (grep `active_customers` writers/readers) and on the OWNER DECISION still open: whether `active_customers` becomes read-only history.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_disable_lead_to_active_customer_STAGED.sql`
- NEW `scripts/tests/sql/lead-to-active-customer-disable.rehearsal.mjs`
- NEW `scripts/tests/sql/fixtures/lead_to_active_customer-prod-shape.sql` (DDL only: minimal `incoming_leads` / `active_customers` columns the function touches, the function body and the trigger def as captured; no rows)

## DATABASE ENTITIES
`public.incoming_leads` (trigger state), `public.active_customers` (asserted not written), function `public.lead_to_active_customer()`.

## DEPENDENCIES
- Read-only prod catalog access to capture the function and trigger definitions (owner-provided), or the TMMT-BUILD-003 snapshot. **If neither is available, STOP.**
- CI wiring via TMMT-BUILD-002 (run by hand until then).

## CONSTRAINTS
- Do **not** apply. Do not drop anything. Do not modify `active_customers` data.
- Do not touch the other 7 `incoming_leads` triggers.

## SECURITY REQUIREMENTS
- The fixture contains no row data and no PII.
- The migration must not change grants.

## IMPLEMENTATION NOTES
- Idempotency guard: `DO $$ BEGIN IF EXISTS (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='incoming_leads' and t.tgname='lead_to_active_customer_trg' and t.tgenabled <> 'D') THEN EXECUTE 'ALTER TABLE public.incoming_leads DISABLE TRIGGER lead_to_active_customer_trg'; END IF; END $$;`
- The rehearsal runs the migration twice.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal step 1 (no migration): a status update to `'Contracting'` creates 1 `active_customers` row with `status='Active'` (demonstrates the hazard).
2. Rehearsal step 2 (after the migration): the same update creates 0 rows.
3. Running the migration twice succeeds; on a DB without the trigger it is a no-op.
4. The PR includes the runbook (pre-check, apply, postcondition, rollback) and the open OWNER DECISION.

## TESTS (must fail on the pre-fix code)
- `lead-to-active-customer-disable.rehearsal.mjs`: `Contracting no longer fabricates an Active rental` (fails without the migration); `idempotent`; `absent trigger no-op`.

## DO NOT CHANGE
- `active_customers` rows, the function body, other triggers, `src/` code.

## OWNER GATE
**Prod baton + owner decision** (the owner applies the staged SQL; this task only prepares and rehearses).
