# TMMT-ADR-001

## TASK ID
TMMT-ADR-001

## TITLE
ADR pack for the PM-02 owner decisions: canonical vehicle table, role source of truth, tenancy column, `active_customers` fate, command queue

## PM MILESTONE
PM-02 Canonical data, tenancy and roles (roadmap new-build items 1, 3, 4, 7 decisions)

## OBJECTIVE
Turn each open PM-02 owner decision into a short, evidence-backed Architecture Decision Record with options, consequences and a recommendation, so the owner can decide in one sitting. **Docs only. No code, no schema.**

## WHY (evidence refs)
- SPEC §9.3 (duplicate concepts), §13 (OWNER DECISIONS PM-02), §2.2 (split brain), §10.4 (`active_customers`), §29; ROADMAP PM-02 ("owner decisions recorded as ADRs"); READINESS §11 (owner decisions needed soonest).

## CURRENT BEHAVIOR (file:line)
- Vehicle: `fleet` (43, SoR per `docs/SYSTEM_OF_RECORD.md`) vs `vehicles` (27, booking FK target, all inactive), bridged by `vehicles.fleet_vehicle_id` (no FK). Availability is read from `fleet.vehicle_status` in `src/app/(admin)/bookings/actions.ts`. 21 'Rented' contradicts SQUARE ONE.
- Roles: the app reads JWT `app_metadata.role` (`src/lib/auth-roles.ts:14-51`); the DB reads `profiles.role` + `portal_role` (helpers in E5 §C.2).
- Tenancy: `org_id` vs `organization_id` (both on `incoming_leads`).
- Rental history: `active_customers` 35 (all 'Removed'), still written by `adminUpsert` and the trigger.
- Queues: `ops_messages` (ghost) vs `exec_va_tasks` → `automation_outbox`.

## EXPECTED BEHAVIOR
Five ADRs in `docs/adr/` (or `docs/product/adr/`; check which folder exists first), each ≤ 1 page: Context (with evidence refs), Options (≥2), Consequences (migrations, code paths, tests affected, other tracks affected: GHL M5/M9, credit), Recommendation, **Decision: PENDING OWNER**.
1. ADR-PM02-01 Canonical vehicle table + the fate of the 43 `fleet` rows + where price lives (three price sources).
2. ADR-PM02-02 Role source of truth (JWT vs `profiles.role`), sync direction, `portal_role` managed or retired, the investor removal from `is_internal_ops()`.
3. ADR-PM02-03 One tenancy column name; the plan for `incoming_leads` dual columns.
4. ADR-PM02-04 `active_customers` / `former_customers` → read-only history (and who writes history).
5. ADR-PM02-05 Command/task queue: create `ops_messages`/`ops_threads` or remove the code paths (`/command/desk`, `/executive`, `/operator` feed).

## FILES (in scope)
NEW ADR markdown files only.

## DATABASE ENTITIES
Referenced only: `fleet`, `vehicles`, `profiles`, `org_roles`, `incoming_leads`, `active_customers`, `former_customers`, `exec_va_tasks`, `automation_outbox`.

## DEPENDENCIES
TMMT-BUILD-003 snapshot is helpful (cite it if present). Coordinate ADR-02 with Phase 2A and ADR-01/03 with GHL M5/M9 (share the drafts).

## CONSTRAINTS
Docs only. Do not decide on the owner's behalf. No PII (counts only).

## SECURITY REQUIREMENTS
ADR-02 must state the hostile-authenticated-user test consequences of each option.

## IMPLEMENTATION NOTES
Keep each ADR skimmable: a table of options × consequences.

## ACCEPTANCE CRITERIA (testable)
1. Five ADR files exist, each with ≥2 options, evidence refs to SPEC sections, and `Decision: PENDING OWNER`.
2. Each lists the tasks/milestones it unblocks (PM-05, PM-19, PM-16).
3. Any spec inconsistency found is logged in `S2_SPEC_ISSUES.md`.

## TESTS
None (docs). A reviewer checklist in the PR: every factual claim has a citation.

## DO NOT CHANGE
Any code, schema or data.

## OWNER GATE
Owner decision (each ADR).
