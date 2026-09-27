# TMMT-RENT-004

## TASK ID
TMMT-RENT-004

## TITLE
Hold expiry: a hold carries an expiry, expired holds free the vehicle, and a scheduled sweep transitions them to CANCELLED through the transition function

## PM MILESTONE
PM-05 Rental state machine (roadmap new-build item 3: "Hold expiry"; SPEC §10.1 "HOLD … add expiry", §10.3 "hold expiry — none has a TMMT writer")

## OBJECTIVE
Holds cannot block a vehicle forever. Availability ignores expired holds; a system sweep cancels them with an event.

## WHY (evidence refs)
- SPEC §10.1 (HOLD row: "EXISTING FOUNDATION; add expiry"), §10.3, §23.4 ("Holds expiring" widget = NEW BUILD (expiry)), §25.2 (rental state gate: "hold expiry"); ROADMAP PM-05; E3 §1.1 (`bookings` columns: no expiry column listed — confirm in the snapshot), §5 (`checkAvailability()` over `bookings` + `fleet.vehicle_status`; DB EXCLUDE covers `hold`).

## CURRENT BEHAVIOR (file:line)
- `createBooking` (`src/lib/rental-pricing/create-booking.ts:152-157`) inserts `status='hold'` with `starts_at/ends_at` and quoted cents; no expiry.
- `checkAvailability` (`src/lib/rental-pricing/availability.ts`) treats any `hold` as blocking; the EXCLUDE constraint does the same at the DB.
- No sweep. `pg_cron` runs 10 jobs (E4 §5), none for holds.

## EXPECTED BEHAVIOR
- **Schema (staged, only if the snapshot confirms no such column):** `bookings.hold_expires_at timestamptz` (nullable; set on hold creation to `now() + interval` from `rental_pricing_rules` if a hold-window column exists there, else a constant `HOLD_TTL_HOURS` in code with an OWNER DECISION on the value). The EXCLUDE constraint is **not** changed (an expired hold still blocks until swept — simple and safe); instead `checkAvailability` **and** the quote path report an expired hold as "expiring/expired, will be released" and the sweep releases it.
- **Sweep:** a staged pg_cron job (`cron.schedule('rental-hold-expiry', '*/15 * * * *', $$select public.rental_expire_holds()$$)`) calling a new SECURITY DEFINER function that, for each `hold` with `hold_expires_at < now()`, calls `rental_transition(booking, 'CANCELLED', 'hold expired', null)` through the system-actor path (TMMT-RENT-002). One event per expired hold. Idempotent.
- `/bookings` board shows the expiry and the "expiring soon" state (token kit; four states).
- `createBooking` sets the expiry; `placeHold` passes it through.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_hold_expiry_STAGED.sql` (column + function + cron schedule, guarded and idempotent)
- `src/lib/rental-pricing/create-booking.ts`, `availability.ts` (+ existing tests), `src/app/(admin)/bookings/actions.ts`, `/bookings` page (display only)
- NEW/extended `scripts/tests/sql/rental-transition.rehearsal.mjs` (expiry cases)

## DATABASE ENTITIES
`bookings` (new nullable column), NEW function `rental_expire_holds`, `cron.job` row (staged). Read: `rental_pricing_rules`.

## DEPENDENCIES
- **TMMT-RENT-002** (function) and **TMMT-RENT-003** (only the function writes status).
- TMMT-BUILD-003 snapshot (confirm no existing expiry column; confirm `rental_pricing_rules` columns).
- OWNER DECISION: hold TTL (hours) and whether expired holds notify the customer (that would be PM-18; not here).

## CONSTRAINTS
- Staged; not applied. The cron schedule is applied by the owner with the baton (switching on a live automation).
- No customer message from the sweep (PM-18).
- Do not change the EXCLUDE constraint.

## SECURITY REQUIREMENTS
- `rental_expire_holds` is `REVOKE`d from anon/authenticated; only `cron`/`service_role` may execute.
- Rehearsal proves a staff user cannot call it and that it only touches `hold` rows past expiry.

## IMPLEMENTATION NOTES
- Keep the TTL in one place (a `rental_pricing_rules` column is preferable to a code constant if the owner wants per-tier windows; else the constant).
- Availability wording: "held until <time>" vs "hold expired, releasing".

## ACCEPTANCE CRITERIA (testable)
1. A new hold has `hold_expires_at` set (fails pre-fix: column absent).
2. Rehearsal: two holds, one expired; after `rental_expire_holds()`, the expired one is `CANCELLED` with one event (reason "hold expired", actor system) and the other untouched; running twice adds no event.
3. `checkAvailability` reports the expired hold as releasable (unit test).
4. Staff cannot execute the sweep function (rehearsal).
5. Migration idempotent; full gate passes.

## TESTS (must fail on the pre-fix code)
- `availability.test.ts`: `expired hold reported as releasable` (fails pre-fix).
- `create-booking.test.ts`: `hold carries expiry` (fails pre-fix).
- Rehearsal: `expire sweep cancels only expired holds via the function`, `sweep idempotent`, `staff cannot run sweep`.

## DO NOT CHANGE
- `bookings_no_overlap`; `enforceFloor`; the transition matrix; other cron jobs; prod.

## OWNER GATE
**Prod baton** (column + function + cron schedule = live automation switch-on). Owner decision on the TTL.
