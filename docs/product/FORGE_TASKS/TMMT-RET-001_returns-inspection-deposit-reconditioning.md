# TMMT-RET-001

## TASK ID
TMMT-RET-001

## TITLE
Returns: RETURN_INITIATED → RETURNED → inspection (`vehicle_events.return_inspection`) → deposit settlement ledgered with evidence → reconditioning → AVAILABLE

## PM MILESTONE
PM-13 Returns, inspection and reconditioning (roadmap; exit "a vehicle becomes AVAILABLE only through inspection, and deposit settlement is ledgered with evidence")

## OBJECTIVE
Close the loop: the rental ends through recorded steps, the deposit (ʿarbūn) is settled with evidence, and the vehicle is available only after inspection.

## WHY (evidence refs)
- SPEC §7 J10 (EXISTING/PARTIAL, unlinked), §10.1 (RETURNED/FINAL INSPECTION/RECONDITIONING/AVAILABLE rows), §10.2 (`RETURNED → CLOSED: inspection done + deposit settled`); ROADMAP PM-13; E3 §1.1 (`vehicle_events.return_inspection` 0; `fleet_car_inspections` 18 Airtable; `rental_ledger` `deposit_return`/`deduction`; `vehicle_handover.handover_type='Return'`).

## CURRENT BEHAVIOR (file:line)
- Return = public handover form 'Return' (now staff, HAND-001), `incoming_leads.status='vehicle returned'` free text (17 rows), no inspection writer, no deposit return path.

## EXPECTED BEHAVIOR
- Transitions via `rental_transition`: `ACTIVE → RETURN_INITIATED` (scheduled), `→ RETURNED` (return handover with photos), inspection recorded as a `vehicle_events.return_inspection` row + damage reports (INC-001), deposit settlement as `rental_ledger` `deposit_return`/`deduction` rows **with evidence refs** (PAY-001 model; deductions need an owner-approved incident charge), `→ CLOSED`. Vehicle state (RENT-005) shows RETURNED → INSPECTION → RECONDITIONING → AVAILABLE, the last only when an inspection event exists and reconditioning is marked done.
- Staged migration only for what the snapshot lacks (a `reconditioning` event type on `vehicle_events`, per ADR).

## FILES (in scope)
Staged migration + rehearsal; return actions on the booking detail; vehicle-state view update; route registry.

## DATABASE ENTITIES
`vehicle_events`, `rental_ledger`, `vehicle_handover`, `bookings`, the vehicle state view.

## DEPENDENCIES
TMMT-RENT-002/005/007, TMMT-HAND-001, TMMT-INC-001, TMMT-PAY-001.

## CONSTRAINTS
No automatic deductions; no sends (return reminder is COMM-006/RENT-008). Legacy 17 text rows untouched.

## SECURITY REQUIREMENTS
Org-scoped staff; deposit rows require evidence (CHECK pattern); hostile/other-org rehearsal.

## IMPLEMENTATION NOTES
Inspection photos via `vehicle_media`; keep `fleet_car_inspections` as history.

## ACCEPTANCE CRITERIA (testable)
1. RETURNED without a handover row → refused; with it → event (rehearsal).
2. CLOSED without inspection or with unsettled deposit → refused.
3. Vehicle AVAILABLE only after inspection + reconditioning done (view test).
4. Deposit rows carry evidence refs.

## TESTS (must fail on the pre-fix code)
Rehearsal: `closed needs inspection and settlement`, `available only via inspection`; unit: `deduction needs approved charge`.

## DO NOT CHANGE
`fleet_car_inspections`; legacy lead statuses; prod.

## OWNER GATE
Prod baton; owner approves each deduction.
