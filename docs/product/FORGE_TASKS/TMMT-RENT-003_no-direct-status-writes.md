# TMMT-RENT-003

## TASK ID
TMMT-RENT-003

## TITLE
Close every other writer of rental status: RLS stops direct `UPDATE bookings.status`, and a static guard proves no code path or trigger writes a rental status outside the transition function

## PM MILESTONE
PM-05 Rental state machine (roadmap new-build item 2: "RLS change: staff cannot UPDATE `bookings.status` directly"; exit criterion "No code path or trigger writes a rental status outside the function (static check)")

## OBJECTIVE
Make the transition function the only way a booking changes state, at the database and in the code.

## WHY (evidence refs)
- SPEC §10.2 rule 1, §10.5 (#2 `adminUpsert` free-text statuses, #3 `bookings_staff_all`), §5.3 security risks, §28 **KD-07** (trigger, already disabled by TMMT-DATA-001); ROADMAP PM-05 exit; E3 §2 (unguarded writes 1–6).

## CURRENT BEHAVIOR (file:line)
- `bookings_staff_all` policy (prod) permits UPDATE of every column for `is_staff()`.
- `adminUpsert` (`src/app/(admin)/admin-actions.ts:10-58`) has a 22-table allow-list; confirm whether `bookings` is in it (E2 §1.3 says `/bookings` writes via `loadBoard/placeHold/addVehicleToBoard`, not `adminUpsert`). `adminUpsert` sets any string on `fleet.vehicle_status`, `active_customers.status`, `customer_payments.payment_status`.
- `lead_to_active_customer_trg`: disabled by TMMT-DATA-001 (prerequisite).
- `sweep_overdue_payments` and `runGhlStageAutoOps` write payment/case status, not `bookings.status` (handled by PM-06 / TMMT-RENT-006).

## EXPECTED BEHAVIOR
- Staged migration `_staged/<ts>_bookings_status_write_guard_STAGED.sql`: replace `bookings_staff_all` with policies that allow staff INSERT (hold) and UPDATE of **non-status** columns only. Postgres RLS cannot scope by column, so use one of: (a) a `BEFORE UPDATE` trigger `bookings_block_direct_status_change` that raises unless a session flag set only inside `rental_transition` is present (`current_setting('tmmt.rental_transition', true) = 'on'`), or (b) `REVOKE UPDATE (status) ON bookings FROM authenticated` (column-level privilege) with the function running as definer. Choose (b) if the snapshot shows column grants are manageable; otherwise (a). Record the choice.
- `adminUpsert`: `bookings` is removed from the allow-list if present; a unit test pins the allow-list.
- Static guard test `src/lib/guards/no-direct-rental-status-write.test.ts`: scans `src/` for `.from("bookings")` followed by `.update(` or `.upsert(` with a `status` key, and for `status:` in insert payloads other than `hold` in `create-booking.ts`; allow-list = `src/lib/rental/transition.ts` only. Asserts non-zero files scanned. Also scans `supabase/migrations/**` (applied + staged) for `UPDATE public.bookings SET status` outside the transition function.
- Rehearsal (extends `rental-transition.rehearsal.mjs`): same-org staff `UPDATE bookings SET status='active'` now raises; the function still works.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_bookings_status_write_guard_STAGED.sql`
- `scripts/tests/sql/rental-transition.rehearsal.mjs` (extend) or NEW `bookings-status-guard.rehearsal.mjs`
- NEW `src/lib/guards/no-direct-rental-status-write.test.ts`
- `src/app/(admin)/admin-actions.ts` (allow-list only, if needed) + test

## DATABASE ENTITIES
Policies/grants/trigger on `bookings`. No new table.

## DEPENDENCIES
- **TMMT-RENT-002** (the function must exist before direct writes are blocked, or nobody can change state).
- TMMT-DATA-001 applied.

## CONSTRAINTS
- Staged; not applied.
- Do not block `insurance_verified`, `lot_release_approved` and discount columns for staff (PM-08 needs them); only `status`.
- Do not touch `fleet.vehicle_status` / `active_customers.status` writes here (TMMT-RENT-005 / ADR-04).

## SECURITY REQUIREMENTS
- Rehearsal roles: same-org staff (blocked on status, allowed on other columns), platform admin (blocked too — the owner also goes through the function; record if the owner disagrees), service_role (blocked unless through the function's system path), hostile authenticated, anon.
- The session-flag approach (a) must be unforgeable from a client connection: PostgREST callers cannot `SET` custom GUCs across the RPC boundary; prove it in the rehearsal.

## IMPLEMENTATION NOTES
- Column privilege (b) is simpler and visible in `information_schema.column_privileges`; the function must then be SECURITY DEFINER owned by a role that keeps UPDATE(status).

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal: direct status UPDATE by staff raises (fails before this migration — this is the meaningful red run RENT-002 documented).
2. The function still transitions; non-status columns still updatable by staff.
3. Static guard passes on the repo and fails on a synthetic `.from("bookings").update({status:"active"})` fixture; non-zero scan count.
4. `adminUpsert` allow-list pinned by a test and excludes `bookings`.
5. Full gate passes.

## TESTS (must fail on the pre-fix code)
- Rehearsal: `staff cannot set bookings.status directly` (fails pre-migration).
- `no-direct-rental-status-write.test.ts`: `no status writes outside transition.ts` (synthetic fixture red); `scanned files > 0`.
- `admin-actions.test.ts`: `bookings not in adminUpsert allow-list`.

## DO NOT CHANGE
- `bookings_no_overlap`; the transition function's matrix (RENT-001/002); other tables' policies; prod.

## OWNER GATE
**Prod baton** to apply. Owner decision whether platform admin is also bound to the function (recommended: yes).
