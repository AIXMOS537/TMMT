# TMMT-UX-003

## TASK ID
TMMT-UX-003

## TITLE
Dealer desk read-only (slice 16b): inventory and leads pages ported from the archive for licensed operator orgs, plus the dealer-admin invite (T08) folded into `signup-invite.ts`

## PM MILESTONE
PM-16 Flagship UX, slice 16b (roadmap: "dealer desk read-only (inventory, leads) and the dealer-admin invite folded into `signup-invite.ts` (respect protected columns)")

## OBJECTIVE
The second owner-URGENT port lands on real tables under per-org staff scope, without any payment or collections features until PM-06.

## WHY (evidence refs)
- SPEC §5.14 (dealer desk absent), §6.5 (`(internal)/internal/dealer/*` 10 pages; T08 invite flow), §23.2 (Dealer nav group), §33 (conditions: PM-02; collections follow mercy/no-riba; payments owner-gated); READINESS §9 #2, #5; ROADMAP PM-16 16b; E6 (T08: `agency/invite-actions.ts`, `invite-dealer-admin-form.tsx`, `app-url.ts`; `src/lib/invites/` never captured — check the M1); E3 §7 (`0033_dealer_instance_inventory.sql` never on TMMT prod; `vin_number` vs `vin`).

## CURRENT BEHAVIOR (file:line)
- Canon: `/operator/*` (broken feed), `/operators` (owner provisioning), `src/lib/signup-invite.ts`; no dealer pages.

## EXPECTED BEHAVIOR
- `(operator)/operator/dealer/{inventory,leads}` (URL per owner decision) reading the canonical vehicle table (ADR-01) and `incoming_leads` for the operator's org through per-org scope (TMMT-DATA-003); read-only; token kit; four states.
- Dealer-admin invite: `inviteDealerAdmin(orgId)` in `signup-invite.ts` (service role, server-only; sets `profiles.role='internal_team'`, `organization_id` — respecting the protected-columns trigger), owner-only action on `/operators`; no send (link handed to the owner).
- The `deals`, `collections`, `payments`, `service` pages are **not** ported here (16c after PM-06; mercy/no-riba review).

## FILES (in scope)
New pages (+ tests), `src/lib/signup-invite.ts` (+ test), `/operators` action; route registry rows.

## DATABASE ENTITIES
Read: vehicles (canonical), `incoming_leads`, `organizations`; write: `signup_invites`, `profiles` (via admin API).

## DEPENDENCIES
TMMT-ADR-001, TMMT-DATA-003 (per-org scope — **required**; without it a dealer would see every org's leads), TMMT-AUTH-003 (operator home), TMMT-AUTH-004 (invite pattern), Phase 2A A4b coordination.

## CONSTRAINTS
Read-only. No money. No archive migration applied. No bundle pushed.

## SECURITY REQUIREMENTS
Two-org rehearsal (dealer A sees 0 of B); hostile authenticated; invite is owner-only; no email in URLs.

## IMPLEMENTATION NOTES
Re-write for Next 16/React 19/Tailwind 4; map `vin_number` → `vin`.

## ACCEPTANCE CRITERIA (testable)
1. Dealer staff of org A see A's inventory/leads only (rehearsal; fails without DATA-003 — the task must not ship before it).
2. Invite creates an `internal_team` profile bound to the org; protected columns respected.
3. DoD per page.

## TESTS (must fail on the pre-fix code)
Rehearsal (two orgs); `signup-invite.test.ts` (`dealer admin role and org`); page state tests.

## DO NOT CHANGE
`/operators` provisioning RPCs; `profiles` trigger; prod.

## OWNER GATE
Owner decisions (URL; who invites). Merge = deploy: owner + baton.
