# TMMT-RENT-007

## TASK ID
TMMT-RENT-007

## TITLE
Desk rentals board on the new states, transitions as guarded actions, and `active_customers` / `former_customers` as read-only history

## PM MILESTONE
PM-05 Rental state machine (roadmap new-build items 6–7: "`active_customers` / `former_customers` → read-only history (OWNER DECISION)"; "Desk rentals board on the new states")

## OBJECTIVE
Staff run rentals from `/bookings` using the transition function, see the event trail, and no longer type rental status into Airtable-era tables.

## WHY (evidence refs)
- SPEC §5.3 (files, acceptance), §8.1 (desk today), §10.4 (OWNER DECISION on `active_customers`), §10.5 #2, §23.2 (Rentals nav: "rentals board on `bookings`; `/customers` LEGACY"), §29 (Airtable-shaped text columns); READINESS §8 ("`active_customers` / `former_customers` as live tables → read-only history"); ROADMAP PM-05; E2 §1.3 (`/bookings` = the only screen writing `bookings`; `/customers`, `/former-customers` LEGACY via `adminUpsert`); E3 §1.1.

## CURRENT BEHAVIOR (file:line)
- `/bookings` (`src/app/(admin)/bookings/page.tsx`, `actions.ts`: `loadBoard/placeHold/addVehicleToBoard`; reads `vehicles`, `fleet`, `bookings`, `rental_pricing_rules`, `rental_insurance_products`).
- `/customers` (`customers/page.tsx:69` writes `active_customers` via `adminUpsert`, `:126` `vin_number` field), `/former-customers` (`former-customers/page.tsx`) — LEGACY tables, 35 rows all 'Removed', 1 row.
- `adminUpsert` allow-list includes `active_customers` (confirm) and lets any string into `status`.
- No UI for confirmed/active/completed/cancelled/no_show; no event trail.

## EXPECTED BEHAVIOR
- `/bookings`: a booking detail panel (token kit `DetailPanel` pattern) with the current state, the allowed next transitions (from the ADR matrix, fetched from the rules table or a shared TS copy that a test keeps in sync with the SQL), a reason field (required where the matrix says), an evidence-ref field for money-gated transitions, and the event trail from `rental_events`. Each button calls `src/lib/rental/transition.ts`. Four states (loading/empty/error/success); mobile usable at 375 px; no `alert()`.
- `/customers` and `/former-customers`: read-only (per ADR-04, TMMT-ADR-001). `active_customers` and `former_customers` are removed from the `adminUpsert` allow-list; the pages show a "history (Airtable era)" banner and link to `/bookings`. If ADR-04 decides to keep some editing (for example contact fields), scope it explicitly and keep `status` read-only.
- A staged migration removes staff UPDATE/INSERT policies on `active_customers` / `former_customers` (keeps SELECT), per ADR-04.
- Route registry rows updated.

## FILES (in scope)
- `src/app/(admin)/bookings/{page.tsx,actions.ts}` + NEW `booking-detail.tsx` (+ tests)
- `src/app/(admin)/customers/page.tsx`, `former-customers/page.tsx` (read-only), `src/app/(admin)/admin-actions.ts` (allow-list) + test
- NEW `supabase/migrations/_staged/<ts>_active_customers_read_only_STAGED.sql` + rehearsal
- NEW `src/lib/rental/transition-matrix.ts` (+ a test that compares it with the SQL rules)

## DATABASE ENTITIES
Read: `bookings`, `rental_events`, `vehicles`/view (RENT-005). Policies on `active_customers`, `former_customers` (staged). No new table.

## DEPENDENCIES
- **TMMT-RENT-002/003** (function; direct writes blocked), **TMMT-RENT-005** (vehicle state for the board), **TMMT-ADR-001 ADR-04** (history decision).
- TMMT-DATA-002 (the `vin_number` fields on these pages).
- PM-06/PM-07 supply real evidence for DEPOSIT_PAID/SIGNED later; until then those transitions require a named-verifier evidence ref typed by staff (visible as "Pending verification").

## CONSTRAINTS
- No new tables. No customer-facing output (PM-16c).
- The desk pages are `"use client"` reading through the browser anon client with RLS as the only gate (E2 §1.3): the transition call must go through a **server action** using the SSR user client, never the browser client.

## SECURITY REQUIREMENTS
- Server action checks `isStaffUser` and relies on the function's own org check; tests include hostile authenticated and other-org staff (function raises "not found").
- The evidence ref is free text here but must be validated (length, no URLs to unknown hosts) and shown as "Pending verification" until PM-06 supplies processor evidence.

## IMPLEMENTATION NOTES
- Derive buttons from the matrix; never hard-code transitions in the component.
- Keep the old `placeHold` path; it becomes the HOLD entry.

## ACCEPTANCE CRITERIA (testable)
1. Every allowed transition is reachable from the detail panel and forbidden ones are not rendered; the matrix TS ↔ SQL sync test passes.
2. A transition writes through the function and the trail shows the event (integration test with the rehearsal DB or a route-level test against a real request shape).
3. `/customers` cannot write `active_customers.status` (allow-list test; rehearsal for the staged policy).
4. Four UI states present; 375 px usable; no `alert()`.
5. Route registry rows updated; full gate passes.

## TESTS (must fail on the pre-fix code)
- `transition-matrix.test.ts`: `TS matrix equals SQL rules` (fails when either drifts).
- `booking-detail.test.tsx`: `renders only allowed transitions`, `money-gated requires evidence`.
- `admin-actions.test.ts`: `active_customers not writable via adminUpsert` (fails pre-fix).
- Rehearsal: `staff cannot update active_customers` (fails pre-migration).

## DO NOT CHANGE
- `placeHold` pricing behaviour; `fleet` data; credit files; prod.

## OWNER GATE
Owner decision ADR-04; **prod baton** for the read-only policy migration. Merge = deploy: owner + baton.
