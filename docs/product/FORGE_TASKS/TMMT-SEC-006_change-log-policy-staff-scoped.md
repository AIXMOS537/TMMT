# TMMT-SEC-006

## TASK ID
TMMT-SEC-006

## TITLE
Prepare and rehearse: replace `change_log` authenticated `ALL true` with a staff-scoped policy (staged, not applied)

## PM MILESTONE
PM-00 Security containment (roadmap item 00-j)

## OBJECTIVE
Any signed-in account (possibly self-signed-up, AUTH-SIGNUP-001) can currently read, edit and delete ops change history. Produce a reviewed, rehearsed migration that closes this. **The owner applies it with the baton**; this task does not.

## WHY (evidence refs)
- SPEC §20.3 **SEC-12**, §28 **KD-24**; E5 §C.3 (22 literal-`true` policies as of 2026-09-21; `change_log` and `partner_acquisition` were the two authenticated ALL `true` — `partner_acquisition` was REMEDIATED on prod 2026-09-22, so `change_log` is the **only remaining** one), §C.7 (MEDIUM); ROADMAP 00-j (exit: `pg_policies` shows no authenticated `ALL true` on `change_log`).
- `change_log` has 2 rows.

## CURRENT BEHAVIOR (file:line)
- Prod catalog: `change_log` has an authenticated `ALL` policy with `USING (true)` / `WITH CHECK (true)` (E5 §C.3).
- **There is no repo migration defining `change_log`** (grep of `supabase/migrations` finds none). The prod-only migration `change_log_from_airtable_retirement` created it (E3 §1.6). Its exact columns and policy names must be read from the prod catalog (read-only) or the PM-01 snapshot.
- App readers/writers of `change_log`: grep `src/` and list them in the PR (there may be none).

## EXPECTED BEHAVIOR
- A staged migration `supabase/migrations/_staged/<ts>_change_log_staff_scope_STAGED.sql` that:
  - drops the authenticated `ALL true` policy (by its real prod name);
  - adds SELECT for `is_staff()` (or `is_platform_admin()` if the owner prefers; record the choice);
  - makes INSERT append-only for staff (no UPDATE/DELETE for authenticated);
  - `REVOKE ALL ON public.change_log FROM anon, authenticated`, then grants exactly what the policies need;
  - is idempotent (guards with `IF EXISTS` / catalog checks).
- A PGlite rehearsal proving the before and after behaviour.
- A postcondition query for the owner to run after applying: `select policyname, roles, cmd, qual, with_check from pg_policies where tablename='change_log';`.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_change_log_staff_scope_STAGED.sql`
- NEW `scripts/tests/sql/change-log-policy.rehearsal.mjs` + fixture `scripts/tests/sql/fixtures/change_log-prod-shape.sql` (a table + policy shape copied from the prod catalog, with **no row data**)

## DATABASE ENTITIES
`public.change_log` (policies, grants only; no column change).

## DEPENDENCIES
- Read-only access to the prod catalog to capture the real table and policy definitions (owner provides it, or use the TMMT-BUILD-003 snapshot when it exists). **If neither is available, STOP.**
- CI wiring of the rehearsal lands with TMMT-BUILD-002; until then, run it by hand and paste the output.

## CONSTRAINTS
- Do **not** apply to prod. Do not touch `partner_acquisition` (separate workstream).
- Keep app writers working: if `src/` writes `change_log` as an authenticated non-staff user, STOP and report.

## SECURITY REQUIREMENTS
- The rehearsal covers: anon (no access), a **hostile authenticated user** (no staff role: cannot select, insert, update or delete), staff (select + insert only), service_role (unchanged).
- Default-ACL hazard: explicit `REVOKE` (SEC-16).

## IMPLEMENTATION NOTES
- Follow the pattern of `scripts/tests/sql/profiles-access-columns.rehearsal.mjs` (roles `anon`/`authenticated`/`service_role`, stub `auth.uid()`, a stub `is_staff()` reading a fixture `profiles` table).
- Run the migration twice in the rehearsal (idempotency), like `prod-write-baton.rehearsal.mjs`.

## ACCEPTANCE CRITERIA (testable)
1. On the fixture **before** the migration: the hostile authenticated user can UPDATE and DELETE `change_log` (the rehearsal demonstrates the hole).
2. **After**: the hostile authenticated user gets 0 rows / a permission error for select, insert, update and delete; staff can select + insert and cannot update or delete; anon has nothing.
3. Running the migration twice is a no-op the second time.
4. The PR includes the postcondition query and a rollback SQL (restore the previous policy) for the owner.

## TESTS (must fail on the pre-fix code)
- `change-log-policy.rehearsal.mjs`: `hostile authenticated cannot delete change_log` (fails when run against the fixture without the migration); `staff append-only`; `anon denied`; `idempotent`.

## DO NOT CHANGE
- Any other table's policies. `is_staff()`. `partner_acquisition`.

## OWNER GATE
**Prod baton** (the owner applies the staged migration after review; acquire → assert → apply → postcondition → release).
