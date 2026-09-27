# TMMT-DATA-003

## TASK ID
TMMT-DATA-003

## TITLE
Per-org staff scope, pilot table group: replace global `is_staff()` with an org-scoped helper on the rental-core `*_org_all` policies, with a two-org rehearsal (staged, not applied)

## PM MILESTONE
PM-02 Canonical data, tenancy and roles (roadmap item 5: "the largest security change; phase it table-group by table-group")

## OBJECTIVE
Prove the pattern that ends cross-tenant staff reads: an `is_staff_of(org_id)`-style helper and a rewritten `*_org_all` policy on one bounded table group, rehearsed with two orgs. Later groups repeat the pattern.

## WHY (evidence refs)
- SPEC §20.1, §20.3 **SEC-03**, §28 **KD-03**, §25.2 (tenant isolation gate); READINESS §5 #9 ("not safe for more than one tenant"); ROADMAP PM-02 item 5; E5 §C.4 (`is_staff()` in 189 policies; `*_org_all` = `is_staff() OR (org_id IS NOT NULL AND is_org_member(org_id))`, so `is_staff()` short-circuits).
- 9 organizations exist on prod.

## CURRENT BEHAVIOR (file:line)
- Prod helper `is_staff()` = `profiles.role ∈ {admin, internal_team}` OR `portal_role ∈ {team_member, manager, admin, super_admin}`; SECURITY DEFINER; **no org argument** (E5 §C.2).
- `is_org_member(org)` = `org_roles` row OR (`profiles.organization_id = org` AND role ∈ {admin, internal_team}).
- Pattern on 119 tenant-bearing tables: `*_org_all` policies (E5 §C.4). `bookings` has 4 policies incl. `bookings_staff_all` (E3 §1.1).
- `org_roles.tenant_admin_write` recurses (42P17) — Phase 2A **A12** owns that fix; the helper here must not depend on a policy read of `org_roles` from within a policy (use the SECURITY DEFINER helper path).

## EXPECTED BEHAVIOR
- A staged migration `supabase/migrations/_staged/<ts>_staff_scope_pilot_STAGED.sql` that:
  - adds `public.is_staff_of(p_org uuid) returns boolean` (SECURITY DEFINER, `search_path public, pg_temp`, `REVOKE EXECUTE FROM anon`): true when `is_platform_admin()`, or when the caller is `internal_team` (or a staff `portal_role`) **and** `profiles.organization_id = p_org`, or has an `org_roles` row for `p_org`;
  - rewrites the `*_org_all` (and `bookings_staff_all`) policies on the **pilot group only**: `bookings`, `vehicles`, `rental_pricing_rules`, `rental_insurance_selections`, `client_journey` (confirm names from the TMMT-BUILD-003 snapshot) to `is_platform_admin() OR is_staff_of(org_id)`;
  - keeps every other policy untouched; is idempotent; includes rollback SQL.
- A two-org PGlite rehearsal: staff of org A reads/writes A only; staff of org B sees 0 of A; a **hostile authenticated user** with no org sees 0; platform admin sees both; anon sees nothing; customer path unchanged.
- A short ADR note on which tables come next (groups: leads/intake — coordinate GHL M9; payments; documents; ops).

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_staff_scope_pilot_STAGED.sql`
- NEW `scripts/tests/sql/staff-scope-pilot.rehearsal.mjs` + `scripts/tests/sql/fixtures/staff-scope-pilot-shape.sql` (DDL from the snapshot, no rows)
- Docs: `docs/saas/TENANT_ISOLATION_TEST_MATRIX.md` (append the pilot rows)

## DATABASE ENTITIES
Policies on `bookings`, `vehicles`, `rental_pricing_rules`, `rental_insurance_selections`, `client_journey`; new function `is_staff_of`. Read: `profiles`, `org_roles`.

## DEPENDENCIES
- **TMMT-ADR-001 ADR-02** (role source of truth) must be decided; the helper reads `profiles.role`/`portal_role` as the DB truth today.
- **TMMT-BUILD-003** snapshot (real policy names).
- **Coordinate with GHL M9** (isolation matrix owner) so the matrix and this rehearsal share fixtures; **do not** touch `incoming_leads`/intake tables here (GHL M1/M9).
- **Phase 2A A12** (`org_roles` recursion): do not fix it here; the helper must work while A12 is open.

## CONSTRAINTS
- Pilot group only. No change to `is_staff()` itself (189 dependants).
- Staged; not applied. Apply is owner + baton after review.
- Desk pages read through the browser anon client with RLS as the only gate (E2 §1.3): after the pilot, a staff user whose `profiles.organization_id` is NULL would see nothing on `/bookings`. The PR must state this and list how many staff profiles have NULL org (aggregate count, owner-provided).

## SECURITY REQUIREMENTS
- The rehearsal covers hostile authenticated, other-org staff, anon, legitimate staff, platform admin, and customer self-read (where a customer policy exists on the table).
- `REVOKE` default grants on any new object (SEC-16).
- No weakening: a table must never end up with fewer restrictions than before.

## IMPLEMENTATION NOTES
- Follow `scripts/tests/sql/profiles-access-columns.rehearsal.mjs` for role fixtures and `auth.uid()` stubbing.
- Keep `is_platform_admin()` as the owner override so `/command` keeps working.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal, pre-migration: staff of org B can read org A's `bookings` (demonstrates the hole).
2. Rehearsal, post-migration: staff of org B reads 0 rows of A on every pilot table; hostile authenticated reads 0; platform admin reads all; migration twice = no-op.
3. `pg_policies` (rehearsal) shows no `is_staff()` reference on the pilot tables.
4. PR contains rollback SQL, the NULL-org staff count, and the next-group plan.

## TESTS (must fail on the pre-fix code)
- `staff-scope-pilot.rehearsal.mjs`: `other-org staff cannot read pilot tables` (fails pre-migration); `hostile authenticated denied`; `platform admin unaffected`; `idempotent`.

## DO NOT CHANGE
- `is_staff()`, `is_org_member()`, `org_roles` policies (2A-A12), intake/GHL tables (M1/M9), credit tables (C1), `profiles`.

## OWNER GATE
**Prod baton** to apply; owner decision on ADR-02 first. Merge of the staged file: owner.
