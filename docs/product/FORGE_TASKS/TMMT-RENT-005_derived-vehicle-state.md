# TMMT-RENT-005

## TASK ID
TMMT-RENT-005

## TITLE
Derived vehicle state: availability comes from bookings and maintenance events, not from the free-text `fleet.vehicle_status`; `partner_vehicle_rentals()` reads booking status, not the clock

## PM MILESTONE
PM-05 Rental state machine (roadmap new-build item 4: "Vehicle state derived from bookings and maintenance events"; exit criterion "`partner_vehicle_rentals()` reads status, not the clock")

## OBJECTIVE
One computed answer to "is this vehicle AVAILABLE / ON_HOLD / RENTED / RETURNED / INSPECTION / RECONDITIONING / MAINTENANCE", used by the booking board, the quote path and the partner view.

## WHY (evidence refs)
- SPEC §10.1 (ACTIVE RENTAL: 4 disagreeing sources; AVAILABLE "not tied to booking end"), §10.2 (vehicle state = separate derived machine), §13 (two vehicle tables; 21 'Rented' vs SQUARE ONE; three price sources), §5.4 acceptance ("vehicle status is derived from bookings/maintenance events, not typed"), §23.4 ("Vehicles by state" = NEW BUILD), §28 **KD-16** context; E3 §0, §2 (`partner_vehicle_rentals()` date-derived stage), §5.

## CURRENT BEHAVIOR (file:line)
- `src/app/(admin)/bookings/actions.ts` reads `fleet.vehicle_status` as live availability; `src/lib/rental-pricing/availability.ts` combines `bookings` + `fleet.vehicle_status`.
- `src/app/(admin)/interfaces/vehicles/page.tsx:135`: `adminUpsert("fleet", { vehicle_status })` free text.
- RPC `partner_vehicle_rentals()` computes `unpaired/upcoming/active/returned` from `now()` vs `starts_at/ends_at`, ignoring `bookings.status` (E3 §2).
- `vehicles.active` (all 27 false) gates the public listing (`src/lib/fleet/public-fleet.ts:37`).
- Maintenance: `maintenance_appointments` (4, Airtable text links), no link to a vehicle state.

## EXPECTED BEHAVIOR
- A staged **view** `public.vehicle_state_v` (name per ADR-01) over the canonical vehicle table (per TMMT-ADR-001 decision): for each vehicle, `state` derived as: MAINTENANCE if an open maintenance job references it (PM-10 will supply the join; until then the view reads `maintenance_appointments` status = 'Scheduled' via the bridge, documented as interim), else RENTED if a booking is `ACTIVE`, else ON_HOLD if a live `hold`/`RESERVED`… (per RENT-001 vocabulary), else RETURNED/INSPECTION/RECONDITIONING if the latest event says so (PM-13 supplies these; interim = not produced), else AVAILABLE if `vehicles.active` (or the ADR's "live" marker), else RETIRED/INACTIVE. `security_invoker = true`; RLS of the base tables applies.
- `availability.ts`, `bookings/actions.ts` read the view instead of `fleet.vehicle_status`.
- `partner_vehicle_rentals()` (staged `CREATE OR REPLACE`) derives its stage from `bookings.status` and the view, not from the clock.
- `adminUpsert("fleet", {vehicle_status})`: the UI stops offering the free-text edit for the states the view now derives (keeps Retired/Coming Soon if ADR-01 keeps `fleet`); a note explains the 21 'Rented' legacy rows are history per ADR-01.
- `/bookings` board "Vehicles by state" widget reads the view.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_vehicle_state_view_STAGED.sql` (view + `partner_vehicle_rentals` replacement, idempotent, `REVOKE`/grants explicit)
- `src/lib/rental-pricing/availability.ts` (+ tests), `src/app/(admin)/bookings/actions.ts`, `src/app/(admin)/interfaces/vehicles/page.tsx` (edit surface), `src/lib/fleet/public-fleet.ts` (only if ADR-01 changes the "live" marker)
- NEW `scripts/tests/sql/vehicle-state.rehearsal.mjs`

## DATABASE ENTITIES
NEW view; ALTER function `partner_vehicle_rentals()`. Read: `vehicles`, `fleet`, `bookings`, `maintenance_appointments`, `vehicle_events`.

## DEPENDENCIES
- **TMMT-ADR-001 ADR-01** (canonical vehicle table; fate of the 43 `fleet` rows; price source) — required.
- **TMMT-RENT-001/002** (status vocabulary; events).
- Coordinate with PM-10 (maintenance → state) and PM-13 (returns) so their events feed this view rather than a second one.
- `/partner` (RPC `get_partner_fleet`) unaffected; confirm.

## CONSTRAINTS
- Staged; not applied.
- Do not migrate or edit `fleet` rows (data reconciliation is a human step, SPEC §30 item 7).
- Do not change pricing (`readFleetRate`, `enforceFloor`).

## SECURITY REQUIREMENTS
- `security_invoker` view so partners/customers see only what base-table RLS allows; rehearsal with partner (`investor` tier via `partner_fleet_access`), staff, hostile authenticated, anon (public listing must still show only `active` vehicles through `vehicles_anon_browse`).

## IMPLEMENTATION NOTES
- Keep the derivation order explicit and documented in the view's comment; MAINTENANCE beats RENTED beats ON_HOLD beats AVAILABLE.
- Interim maintenance join is by the `vehicles.fleet_vehicle_id` bridge (no FK) — state it.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal: a vehicle with an ACTIVE booking is RENTED; with a live hold ON_HOLD; with an open maintenance job MAINTENANCE (precedence); with none and active=true AVAILABLE (fails pre-fix: no view).
2. `partner_vehicle_rentals()` returns `active` only for `ACTIVE` bookings regardless of dates (fails pre-fix: date-derived).
3. `availability.ts` no longer reads `fleet.vehicle_status` (static test) and its unit tests pass against the view shape.
4. Anon public listing unchanged (rehearsal).
5. Migration idempotent; full gate passes.

## TESTS (must fail on the pre-fix code)
- `vehicle-state.rehearsal.mjs`: `derivation precedence`, `partner_vehicle_rentals reads status not clock` (fails pre-migration), `anon sees only active`.
- `availability.test.ts`: updated; static test `no fleet.vehicle_status read in rental-pricing`.

## DO NOT CHANGE
- `fleet` data; pricing logic; `vehicles_anon_browse`; `get_partner_fleet`; prod.

## OWNER GATE
Owner decision ADR-01 first; **prod baton** to apply.
