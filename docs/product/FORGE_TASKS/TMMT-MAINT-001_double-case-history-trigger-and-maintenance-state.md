# TMMT-MAINT-001

## TASK ID
TMMT-MAINT-001

## TITLE
Remove the duplicate `cases` status-history trigger, and make an open maintenance job move the vehicle to MAINTENANCE (blocking bookings) via the derived state

## PM MILESTONE
PM-10 Maintenance (roadmap: "Maintenance → vehicle state transition"; "Fix the double status-history trigger"; exit "a vehicle in maintenance cannot be booked")

## OBJECTIVE
One history row per case status change, and maintenance that actually affects availability.

## WHY (evidence refs)
- SPEC §5.6 (bugs: `cases` double status-history triggers; acceptance: opening a job moves the vehicle to MAINTENANCE and blocks bookings), §17, §28 **KD-35**; ROADMAP PM-10; E4 §5 (`cases_status_history` and `cases_status_history_trg` both call `log_case_status_change`: 12 history rows for 4 cases); E3 §1.1 (`maintenance_appointments` 4, Airtable text links).

## CURRENT BEHAVIOR (file:line)
- Two triggers on `cases` (names above) → same function.
- `maintenance_appointments` has no FK to a vehicle (text links); the vehicle-state view (RENT-005) uses an interim bridge join.

## EXPECTED BEHAVIOR
- Staged migration: `DROP TRIGGER IF EXISTS cases_status_history_trg` (keep the older/named one per the snapshot; record which), idempotent; rehearsal proves one history row per change.
- Maintenance link: add `vehicle_id uuid` FK to the canonical vehicle table on `maintenance_appointments` **if absent** (per ADR-01), a status vocabulary CHECK (`scheduled|in_progress|completed|cancelled`) if the column is free text, and update the RENT-005 view to derive MAINTENANCE from `scheduled|in_progress`. `checkAvailability` (via the view) refuses holds on a MAINTENANCE vehicle.
- `/maintenance` desk page: pick the vehicle from the canonical table; token kit; four states.
- One vendor table (`vendors` vs `shops_mechanics_cleaning`) is an OWNER DECISION recorded in the PR, not executed here.

## FILES (in scope)
Staged migration(s) + rehearsals; `src/app/(admin)/maintenance/*`; `availability.ts` test; vehicle-state view update (RENT-005 file).

## DATABASE ENTITIES
Triggers on `cases`; `maintenance_appointments` (FK/CHECK); the vehicle state view.

## DEPENDENCIES
TMMT-RENT-005, TMMT-ADR-001 (vehicle), TMMT-BUILD-003 (trigger names). Vendor decision: owner.

## CONSTRAINTS
Staged; not applied. Do not migrate the 4 legacy rows' text links automatically (human reconciliation).

## SECURITY REQUIREMENTS
Org-scoped staff writes; rehearsal with hostile/other-org.

## IMPLEMENTATION NOTES
Keep the history function; only remove the duplicate trigger.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal pre-migration: one status change → 2 history rows (the bug); post: 1 row.
2. A scheduled maintenance job → vehicle MAINTENANCE → hold refused (rehearsal + unit test).
3. Completing the job returns the vehicle to AVAILABLE only via the inspection path (PM-13) — interim: to AVAILABLE with an event; documented.
4. Full gate passes.

## TESTS (must fail on the pre-fix code)
`cases-history.rehearsal.mjs`: `single history row` (fails pre-migration). `availability.test.ts`: `maintenance blocks hold` (fails pre-fix).

## DO NOT CHANGE
`log_case_status_change`; vendor tables; prod.

## OWNER GATE
Prod baton (migrations); owner decision on the vendor table.
