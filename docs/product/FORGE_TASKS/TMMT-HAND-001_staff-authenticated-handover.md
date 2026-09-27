# TMMT-HAND-001

## TASK ID
TMMT-HAND-001

## TITLE
Staff-authenticated handover: revoke the anonymous `vehicle_handover` insert, bind the handover to a booking, and gate `READY_FOR_HANDOFF → ACTIVE` on the four preconditions

## PM MILESTONE
PM-08 Handoff (roadmap: "Staff-authenticated handover (revoke anon insert; the ANON-TENANT-001 item for this table, coordinated with GHL M1)"; exit "a handover cannot be recorded without the four preconditions, and anon insert is revoked")

## OBJECTIVE
Nobody can create a "Completed" pickup or return from the open internet, and a rental only becomes ACTIVE when signed + deposit verified + insurance verified + lot release approved, recorded by an authenticated staff member.

## WHY (evidence refs)
- SPEC §7 J7 (MISSING; anon insert `WITH CHECK (true)`), §10.5 #4, §12 (handover checklist: revoke anon insert), §28 **KD-31**, **KD-10** (ANON-TENANT-001); ROADMAP PM-08; E3 §1.1 (`vehicle_handover` 1 row; `anon_insert_handovers`; `customer_signature` text; `handover_type` Pickup/Return; `bookings.insurance_verified`/`lot_release_approved` always false), §4 (typed-name "signature" `forms/handover/page.tsx:133`).

## CURRENT BEHAVIOR (file:line)
- `src/app/forms/actions.ts:563` `submitHandover` (public form) → `vehicle_handover` via the anon policy; `src/app/forms/handover/page.tsx`.
- No `booking_id` on `vehicle_handover` (text links only, E3 §1.7) — confirm in the snapshot.
- `bookings.insurance_verified`, `lot_release_approved`: nothing sets them.

## EXPECTED BEHAVIOR
- Staged migration: drop `anon_insert_handovers`; staff INSERT/SELECT scoped by org; add `booking_id uuid` FK (nullable for legacy) **if absent**; `REVOKE` defaults. Coordinate with **GHL M1** (it owns the ANON-TENANT-001 list; if M1's migration already covers this table, reference it and do not duplicate).
- The handover form moves behind staff auth (`(admin)` route or a staff-only server action) and requires a booking; photos via `vehicle_media` (PR #251 walk-around pattern) — reference, do not merge #251.
- Staff actions to set `insurance_verified` (with `rental_insurance_selections` reference) and `lot_release_approved`; the ACTIVE transition through `rental_transition` checks all four preconditions (SIGNED evidence from DOC-002, DEPOSIT_PAID evidence per PAY-001 interim = named verifier ref).
- Customer pickup checklist in the portal is PM-16c; not here.

## FILES (in scope)
Staged migration + rehearsal; `src/app/forms/actions.ts` (`submitHandover` → staff), `src/app/forms/handover/page.tsx` (move/guard), booking detail actions (RENT-007); route registry rows.

## DATABASE ENTITIES
`vehicle_handover` (policies, `booking_id`), `bookings` (two boolean columns, via staff actions), `vehicle_media`.

## DEPENDENCIES
TMMT-RENT-002/007, TMMT-DOC-002, TMMT-PAY-001 (interim evidence rule), **GHL M1** coordination, PR #251 (reference).

## CONSTRAINTS
Staged; not applied. Legacy 1 row untouched. No customer send.

## SECURITY REQUIREMENTS
Rehearsal: anon insert denied; hostile authenticated denied; other-org staff denied; same-org staff allowed with a booking. Function refuses ACTIVE without all four preconditions.

## IMPLEMENTATION NOTES
Keep the checklist fields; replace the typed-name "signature" with the staff actor + timestamp (customer signature comes with PM-07).

## ACCEPTANCE CRITERIA (testable)
1. Anon POST to the handover path is refused (fails pre-fix).
2. ACTIVE transition refused with any precondition missing; allowed with all four (rehearsal).
3. Handover row links a booking and the staff actor.
4. Full gate passes; M1 coordination recorded.

## TESTS (must fail on the pre-fix code)
Rehearsal: `anon cannot insert vehicle_handover` (fails pre-migration); `active needs four preconditions`. Action tests: `handover requires staff + booking`.

## DO NOT CHANGE
PR #251 content; `vehicle_media` policies; prod.

## OWNER GATE
Prod baton (migration). Merge = deploy: owner + baton.
