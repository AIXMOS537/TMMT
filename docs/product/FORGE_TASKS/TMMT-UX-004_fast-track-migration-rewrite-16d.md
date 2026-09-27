# TMMT-UX-004

## TASK ID
TMMT-UX-004

## TITLE
Fast Track (slice 16d): rewrite the rescued `applications` migration first (org_id, staff-only read, no `WITH CHECK (true)`, REVOKE, durable limiter), then port `/apply*` behind the GHL M8 intake contract

## PM MILESTONE
PM-16 Flagship UX, slice 16d (roadmap: "the Fast Track port, with its `applications` migration rewritten first"; SPEC §30 item 6)

## OBJECTIVE
Recover the Fast Track application flow without importing its security holes, and without competing with the universal intake contract.

## WHY (evidence refs)
- SPEC §6.5 (T07 `/apply`, `/apply/[slug]`, `/apply/packet`; "migration must be rewritten first"), §30 item 6, §33 (top 3 and top 4); READINESS §9 #3–#4; ROADMAP PM-16 16d; E3 §7 (`20260825000000_fast_track_applications.sql`: public INSERT `WITH CHECK (true)`, authenticated SELECT all, no length caps; `applications` does not exist in prod); E2 §5 (overlaps `/forms/apply`, `/forms/operator-apply`).

## CURRENT BEHAVIOR (file:line)
- Nothing in canon; the rescue is at `C:\TechHaus-Archive\TMMT\rescue-2026-09-21\07-fast-track-overlay\files\src\app\` (read, never push).

## EXPECTED BEHAVIOR
- Part 1 (this task): staged migration `_staged/<ts>_fast_track_applications_STAGED.sql` — `applications` with `org_id NOT NULL` (server-derived), capped text columns, RLS: staff-of-org read (`is_staff_of`), no public INSERT policy (inserts go through a server action with `isRateLimitedDurable`, service role), `REVOKE ALL FROM anon, authenticated`; rehearsal with hostile authenticated / other-org / anon.
- Part 2 (gated on GHL M8): the `/apply*` pages ported onto the M8 intake contract as a registered surface with an intake id; until M8 lands, only Part 1 ships and the pages stay unported (recorded).

## FILES (in scope)
Staged migration + rehearsal; later `src/app/apply/*`, `components/fast-track/*`, `lib/fast-track/*` (re-written).

## DATABASE ENTITIES
NEW `applications` (staged).

## DEPENDENCIES
**GHL M8** (intake contract) for Part 2; TMMT-DATA-003; TMMT-BUILD-003.

## CONSTRAINTS
No public INSERT policy, ever. Do not apply. Do not push the bundle. Reconcile with `/forms/apply` (decide which survives with the GHL owner).

## SECURITY REQUIREMENTS
Rehearsal proves anon cannot read or write; other-org staff cannot read; limiter on the action; no PII in fixtures.

## IMPLEMENTATION NOTES
Keep the columns the rescued SQL had, minus anything the M8 contract already stores.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal: anon insert denied, any-authenticated read denied, org-scoped staff read allowed, migration idempotent.
2. Part 2 only after M8, as a registered intake surface.

## TESTS (must fail on the pre-fix code)
Rehearsal (pre: the rescued SQL shape would pass `anon insert` — show it as the red run against the rescued fixture).

## DO NOT CHANGE
Existing `/forms/*` actions (GHL M11 migrates them); prod.

## OWNER GATE
Prod baton (migration); GHL track owns the surface registration.
