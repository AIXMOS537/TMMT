# TMMT-RENT-009

## TASK ID
TMMT-RENT-009

## TITLE
Extensions as a new priced segment on the same rental, with its own quote and verified payment, never overlapping another booking; the GHL `extended` stage becomes a request only

## PM MILESTONE
PM-11 Extensions (roadmap: "the extension segment and transition. The GHL `extended` stage becomes an event request only"; exit "an extension cannot overlap another booking, and it cannot be active without a verified payment or an approved exception")

## OBJECTIVE
A renter who keeps the car longer gets a new, priced, paid segment; the state machine records `ACTIVE → ACTIVE (extension)`.

## WHY (evidence refs)
- SPEC §7 J8 (MISSING; GHL-only `extended`), §10.1 (EXTENDED), §21.2 V3, A-6 (no interest or late-fee revenue on extensions); ROADMAP PM-11; E3 §1.1 (no table; `vehicle_events` has no extension type).

## CURRENT BEHAVIOR (file:line)
- `canonical_renter_stage='extended'` from GHL only; no TMMT writer; `bookings` has one `starts_at/ends_at` range.

## EXPECTED BEHAVIOR
- Design per RENT-001 ADR: either a child booking row (`parent_booking_id`, same vehicle, contiguous range, `status` following the parent) or a `rental_segments` table — **ADR addendum first** (docs), then the staged migration.
- Quote via `/api/rental/quote` for the new range; `enforceFloor`; overlap guard covers the new segment (EXCLUDE on the same vehicle).
- Transition `ACTIVE → ACTIVE` with `event_type='extension'`, evidence = verified payment (PAY-001) or an owner-approved exception ref.
- GHL `extended` stage → request event (RENT-006 path).

## FILES (in scope)
ADR addendum; staged migration + rehearsal; `src/lib/rental-pricing/*` (segment quote), booking detail action; route registry.

## DATABASE ENTITIES
Per ADR (child booking or segments table); `rental_events`; read `rental_pricing_rules`.

## DEPENDENCIES
TMMT-RENT-001/002/007, TMMT-PAY-001 (verified payment), TMMT-RENT-006.

## CONSTRAINTS
No interest, no "late fee" on extensions (test); no send.

## SECURITY REQUIREMENTS
Org-scoped staff; money-gated transition needs evidence; hostile/other-org rehearsal.

## IMPLEMENTATION NOTES
Contiguity check (`new.starts_at = parent.ends_at`) in the function.

## ACCEPTANCE CRITERIA (testable)
1. Overlapping extension on a vehicle with another booking → `23P01` (rehearsal).
2. Extension without evidence → refused; with verified payment → one event.
3. Price = quote (no interest line items) (unit test).

## TESTS (must fail on the pre-fix code)
Rehearsal: `extension cannot overlap`, `needs verified payment`; unit: `no interest on extension quote`.

## DO NOT CHANGE
Parent booking pricing; GHL files beyond RENT-006; prod.

## OWNER GATE
ADR addendum decision; prod baton.
