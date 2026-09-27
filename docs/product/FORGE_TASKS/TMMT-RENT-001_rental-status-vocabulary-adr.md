# TMMT-RENT-001

## TASK ID
TMMT-RENT-001

## TITLE
ADR: rental status vocabulary and event-log design (widen the `bookings.status` CHECK, or keep the coarse status and carry sub-states as events)

## PM MILESTONE
PM-05 Rental state machine (precondition of every other PM-05 task; records the open design gap in `S2_SPEC_ISSUES.md` SI-08)

## OBJECTIVE
Decide, with evidence and owner sign-off, the one status vocabulary and the shape of the append-only transition log before any migration is written. Docs only.

## WHY (evidence refs)
- SPEC §10.1–§10.3 (target states vs the 6-value CHECK), §9.3 (six competing status vocabularies), §5.3 acceptance ("one guarded function… append-only event"), §21.2 V3 (GHL-only stages); ROADMAP PM-05 ("The transition function and event table"); E3 §1.1 (`bookings.status` CHECK `hold|confirmed|active|completed|cancelled|no_show`; unused enum `booking_status` `inquiry|quoted|confirmed|active|completed|cancelled`; `canonical_renter_stage` 13 values; `vehicle_events` enum `turnover|exchange|return_inspection|lto_start|lto_complete`).

## CURRENT BEHAVIOR (file:line)
- `bookings.status` text CHECK with 6 values; `bookings_no_overlap` EXCLUDE covers `hold|confirmed|active` (prod `20260917200051`).
- Only `hold` is ever written (`src/lib/rental-pricing/create-booking.ts:152-157`, `src/app/(admin)/bookings/actions.ts:222`).
- `vehicle_events` (0 rows) has a 5-value enum and FKs to `bookings`, `cases`, `client_journey`.
- `partner_vehicle_rentals()` derives `unpaired/upcoming/active/returned` from `now()` vs dates, ignoring status (E3 §2).
- `client_journey` derived nightly by `recompute_all_journeys()`; `renter_pipeline_status` → `client_renter_status` fed by GHL-verified `crm_sync_records` (V1).

## EXPECTED BEHAVIOR
One ADR (`docs/adr/ADR-PM05-01-rental-status-and-events.md`, or `docs/product/adr/` if that is the folder in use) with:
1. **Options** (≥2): (A) widen the CHECK to the full target list (HOLD, RESERVED, AGREEMENT_READY, SIGNED, DEPOSIT_PAID, READY_FOR_HANDOFF, ACTIVE, INCIDENT_OPEN, RETURN_INITIATED, RETURNED, CLOSED, NO_SHOW, CANCELLED) and extend the EXCLUDE set; (B) keep 6 coarse values and record sub-states as typed events (the event log is the truth; status is a projection); (C) hybrid (a small widening plus events).
2. Consequences per option: EXCLUDE constraint change, `partner_vehicle_rentals()`, `client_journey` recompute, `/bookings` board, `canonical_renter_stage` mapping (GHL M6/M7 raise events), PM-06 money-gated transitions, PM-07 SIGNED, PM-08 ACTIVE preconditions, tests.
3. The **event table proposal** (name proposed `rental_events`; columns: `booking_id`, `org_id NOT NULL`, `from_status`, `to_status`, `event_type`, `actor_profile_id` / `actor_kind` (staff, customer, system, ghl_request), `reason`, `evidence_ref`, `created_at`; append-only; RLS; REVOKE). **Proposal only** — the migration is TMMT-RENT-002.
4. The **transition table** (allowed from→to with preconditions) in one matrix.
5. Relationship to `vehicle_events` (reuse for turnover/return_inspection vs new table) and to the derived vehicle state (TMMT-RENT-005).
6. `Decision: PENDING OWNER`.

## FILES (in scope)
NEW ADR markdown only.

## DATABASE ENTITIES
Referenced only: `bookings`, `vehicle_events`, `client_journey`, `crm_sync_records`, `rental_ledger`, `contract_instances`.

## DEPENDENCIES
- TMMT-ADR-001 (canonical vehicle, `active_customers` fate) — cite its decisions or mark pending.
- TMMT-BUILD-003 snapshot for exact constraint definitions.
- Share the draft with the GHL track (M6/M7 will raise events into this log) and note the credit track is unaffected.

## CONSTRAINTS
Docs only. Do not decide for the owner. No PII (counts only).

## SECURITY REQUIREMENTS
The ADR states, per option, how "no status write outside the function" is enforced (RLS removing direct UPDATE of `status`, TMMT-RENT-003) and who may insert events (only the function; SECURITY DEFINER).

## IMPLEMENTATION NOTES
Keep the transition matrix machine-readable (a markdown table with one row per allowed transition) so TMMT-RENT-002's rehearsal can be generated from it.

## ACCEPTANCE CRITERIA (testable)
1. ADR exists with ≥2 options, consequences, the event-table proposal, the transition matrix and `Decision: PENDING OWNER`.
2. Every state in SPEC §10.2 appears in the matrix as a source or target.
3. Money-gated transitions are marked with the evidence requirement (SPEC §10.2 rule 3).
4. Any spec inconsistency found is logged in `S2_SPEC_ISSUES.md`.

## TESTS
None (docs). Reviewer checklist: every factual claim cites SPEC/E3.

## DO NOT CHANGE
Any code, schema or data.

## OWNER GATE
Owner decision (the ADR).
