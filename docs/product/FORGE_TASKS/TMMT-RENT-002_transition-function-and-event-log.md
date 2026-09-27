# TMMT-RENT-002

## TASK ID
TMMT-RENT-002

## TITLE
The rental transition function and append-only event log: one DB function is the only writer of `bookings.status`, rehearsed for every allowed and forbidden transition (staged, not applied)

## PM MILESTONE
PM-05 Rental state machine (roadmap new-build items 1: "The transition function and event table")

## OBJECTIVE
Replace "anyone with staff RLS can set any status" with one guarded function that validates the transition, checks preconditions and evidence, writes the new status and appends an event with actor, from, to, reason and evidence ref.

## WHY (evidence refs)
- SPEC §10 (verdict: no state machine), §10.2 rules 1–3, §10.3, §10.5 #3, §5.3 acceptance, §25.2 (Rental state gate), §31.1; READINESS §4 #1; ROADMAP PM-05; E3 §2 ("Staff with `bookings_staff_all` RLS can UPDATE any status directly — no transition guard"; nothing sets confirmed/active/completed/cancelled/no_show).

## CURRENT BEHAVIOR (file:line)
- `bookings` (0 rows): `status` CHECK 6 values; 4 policies incl. `bookings_staff_all`; EXCLUDE `bookings_no_overlap` live (E3 §1.1).
- Writers: `createBooking` inserts `hold` (`src/lib/rental-pricing/create-booking.ts:152-157`; `23P01` → conflict); `placeHold` (`src/app/(admin)/bookings/actions.ts:222`). No UPDATE of status anywhere in `src/` (grep).
- Evidence pattern to copy: `payment_obligation_reconciliation` CHECK (`verified_by` + `evidence_ref` when verified) (E3 §3.3).
- No event table. `vehicle_events` (0 rows) is typed for turnover/return_inspection/lto only.

## EXPECTED BEHAVIOR
- Staged migration `_staged/<ts>_rental_transition_STAGED.sql`, implementing the ADR (TMMT-RENT-001) decision:
  - the event table (proposed `public.rental_events`, per ADR; `org_id NOT NULL` derived from the booking; append-only: no UPDATE/DELETE policies; `REVOKE ALL FROM anon, authenticated`; SELECT for `is_platform_admin() OR is_staff_of(org_id)` (or the interim staff check) and for the customer's own booking via the interim email key);
  - `public.rental_transition(p_booking uuid, p_to text, p_reason text, p_evidence_ref text default null) returns rental_events` — SECURITY DEFINER, `search_path public, pg_temp`, `REVOKE EXECUTE FROM anon`; it locks the booking row, reads `from`, checks the transition matrix (a small table `rental_transition_rules` or a `CASE` block — per ADR), checks preconditions (for example `READY_FOR_HANDOFF → ACTIVE` requires signed + deposit verified + `insurance_verified` + `lot_release_approved`; money-gated targets require `p_evidence_ref`), enforces `actor` from `auth.uid()` (or a `p_actor_kind='system'` path callable only by `service_role`), updates `bookings.status`, inserts the event, and `RAISE EXCEPTION` with a stable SQLSTATE/message on any violation;
  - if the ADR chose to widen the CHECK, the CHECK and the EXCLUDE status set are updated in the same migration;
  - idempotent; rollback SQL.
- A server wrapper `src/lib/rental/transition.ts` calling the RPC with the SSR user client (so RLS and `auth.uid()` apply) and mapping the SQLSTATE to typed errors; `placeHold`/`createBooking` unchanged (HOLD is still the insert path) — or the insert is routed through the function if the ADR says so.
- PGlite rehearsal generated from the ADR's transition matrix: every allowed transition succeeds and writes exactly one event; every forbidden pair raises; money-gated transitions raise without `evidence_ref`; the overlap guard still raises `23P01` on a conflicting `RESERVED/ACTIVE`; a hostile authenticated user and other-org staff cannot call the function on a booking they cannot see; anon cannot execute.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_rental_transition_STAGED.sql`
- NEW `scripts/tests/sql/rental-transition.rehearsal.mjs` + `fixtures/rental-core-shape.sql` (DDL for `bookings`, `vehicles`, `organizations`, `profiles` from the snapshot; no rows)
- NEW `src/lib/rental/transition.ts` (+ `transition.test.ts`)

## DATABASE ENTITIES
NEW `rental_events` (name per ADR), NEW function `rental_transition`, possibly `rental_transition_rules`; ALTER `bookings` CHECK/EXCLUDE only if the ADR says so. Read: `bookings`, `contract_instances` (for SIGNED precondition; until PM-07 exists the precondition is checked against a nullable evidence ref and documented), `payments`/`rental_ledger` (DEPOSIT_PAID evidence; until PM-06 exists, `p_evidence_ref` must be a named-verifier ref, pattern from `payment_obligation_reconciliation`).

## DEPENDENCIES
- **TMMT-RENT-001** decided by the owner.
- **TMMT-DATA-001 applied** (the fabricating trigger disabled) and **TMMT-SEC-007 env off** (GHL auto-ops), per ROADMAP PM-05 "Depends on".
- **TMMT-ADR-001** (vehicle canonical table) for the vehicle-side effects; **TMMT-BUILD-003** snapshot.
- TMMT-DATA-003 helper (`is_staff_of`) preferred; interim staff check otherwise.

## CONSTRAINTS
- Staged; never applied by the builder.
- No writes to `active_customers`, `fleet.vehicle_status`, `crm_sync_records` from the function (vehicle state is derived in TMMT-RENT-005; GHL is event-only in TMMT-RENT-006).
- Do not touch `createBooking` pricing logic or `enforceFloor`.

## SECURITY REQUIREMENTS
- The function must not trust a client-supplied `org_id`; it derives org from the booking.
- Rehearsal roles: anon (no EXECUTE), hostile authenticated (no visible booking → raises "not found", not "forbidden"), other-org staff (same), same-org staff (allowed transitions only), service_role system path (hold expiry, TMMT-RENT-004).
- Events are immutable: rehearsal proves UPDATE/DELETE on the event table is denied to every non-service role.
- `REVOKE` defaults on every new object (SEC-16).

## IMPLEMENTATION NOTES
- `SELECT … FOR UPDATE` on the booking inside the function prevents racing transitions.
- Keep the reason required (non-empty) for CANCELLED, NO_SHOW and every backward transition.
- Follow `prod-write-baton.rehearsal.mjs` for running the migration twice.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal: every row of the ADR matrix passes; every non-listed pair raises (table-driven, non-zero count asserted).
2. A direct `UPDATE bookings SET status` by same-org staff still **succeeds** in this task's rehearsal (that hole is closed by TMMT-RENT-003; the rehearsal documents it so RENT-003's red run is meaningful).
3. Money-gated transitions raise without `evidence_ref`.
4. Overlap guard holds through a RESERVED transition on a conflicting range.
5. Hostile/other-org/anon cases denied; events immutable; migration idempotent.
6. `transition.ts` maps SQLSTATEs to typed errors with unit tests; full gate passes.

## TESTS (must fail on the pre-fix code)
- `rental-transition.rehearsal.mjs`: `allowed transitions write one event each`, `forbidden transitions raise`, `money-gated needs evidence`, `overlap still enforced`, `hostile cannot transition`, `events immutable`, `idempotent`. Pre-migration, the function does not exist (red = missing).
- `transition.test.ts`: SQLSTATE mapping; wrapper uses the user client, never the service role.

## DO NOT CHANGE
- `bookings_no_overlap` semantics (except the status set per ADR); `createBooking` pricing; `active_customers`; GHL files; credit files; prod.

## OWNER GATE
**Prod baton** to apply (owner). ADR decision first. Merge of staged files: owner.
