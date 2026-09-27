# TMMT-INC-001

## TASK ID
TMMT-INC-001

## TITLE
Incidents, damage and tolls/violations against booking and vehicle, on the orphaned `vehicle_damage_reports` foundation, with evidence and owner approval before any charge

## PM MILESTONE
PM-12 Incidents, tolls and damage (roadmap: "A tolls/violations entity; the incident flow; charge-back through PM-06 with owner approval; ⚖️ review of recovery terms"; exit "every charge links to evidence and an approval, and nothing is charged automatically")

## OBJECTIVE
Record what happened, attach evidence, and let the owner decide any recovery — mercifully.

## WHY (evidence refs)
- SPEC §7 J9 (LEGACY/ORPHANED; tolls MISSING), §9.4, §10.1 (INCIDENT), §5.12 n/a; ROADMAP PM-12; E3 §1.1 (`vehicle_damage_reports` 0 rows, `severity` enum, `status` enum `reported|in_review|repair_scheduled|resolved`, FKs to cases/bookings/vehicles/profiles; tolls only as free text on `fleet.tickets` / `active_customers.tickets`).

## CURRENT BEHAVIOR (file:line)
- No writer for `vehicle_damage_reports`; PR #251 (walk-around photos) open, not merged; `cases` used for ops.

## EXPECTED BEHAVIOR
- Staged migration: NEW `vehicle_violations` (proposed name; tolls/tickets: booking, vehicle, org, occurred_at, kind, amount_cents, evidence doc, status, owner_decision, `REVOKE`, RLS org-scoped); no new columns on `vehicle_damage_reports` unless the snapshot lacks `org_id`.
- Staff flows: report damage (photos to `vehicle_media`), record a toll/violation with evidence; transition `ACTIVE → INCIDENT_OPEN` / back via `rental_transition`.
- Charge-back: a proposal row only; the actual charge is PM-06 with owner approval (`owner_decision` set by an owner-only action); nothing automatic. ⚖️ recovery terms flagged for review.

## FILES (in scope)
Staged migration + rehearsal; `src/app/(admin)/incidents/*` (+ tests); booking detail actions; route registry.

## DATABASE ENTITIES
`vehicle_damage_reports` (first writer), NEW `vehicle_violations`, `vehicle_media`, `rental_events`.

## DEPENDENCIES
TMMT-RENT-002/007, TMMT-HAND-001 (photos pattern), TMMT-PAY-001 (charge model), PR #251 (reference only).

## CONSTRAINTS
No charges, no sends. Do not merge #251.

## SECURITY REQUIREMENTS
Org-scoped; owner-only decision action (hostile + staff refused); evidence required before a proposal.

## IMPLEMENTATION NOTES
Reuse the `severity`/`status` enums; keep the incident state on the booking via events, not a new status column.

## ACCEPTANCE CRITERIA (testable)
1. Damage report writes a row + INCIDENT_OPEN event (fails pre-fix: no writer).
2. A charge proposal without evidence is refused; with evidence it awaits an owner decision; no money row is written.
3. Two-org rehearsal on the new table.

## TESTS (must fail on the pre-fix code)
Rehearsal: `violations org-scoped`, `hostile denied`; unit: `proposal needs evidence`, `owner-only decision`.

## DO NOT CHANGE
Dispatch `incidents` (rescue vertical; naming collision); prod.

## OWNER GATE
Prod baton; ⚖️ recovery terms review; owner approves each charge.
