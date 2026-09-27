# TMMT-DATA-004

## TASK ID
TMMT-DATA-004

## TITLE
Take `investor` out of `is_internal_ops()`, remove the investor INSERT/UPDATE policies on `rental_ledger`, and drop the `insurance.login_*` credential columns (staged, rehearsed, not applied)

## PM MILESTONE
PM-02 Canonical data, tenancy and roles (roadmap items 4 and 8)

## OBJECTIVE
Three small privilege clean-ups the SPEC assigns to PM-02, prepared as one reviewed migration with a rehearsal, for the owner to apply with the baton.

## WHY (evidence refs)
- SPEC §20.3 **SEC-19** (`is_internal_ops()` includes investor → DELETE on credit tables; `rental_ledger` investor INSERT/UPDATE), **SEC-23** (`insurance.login_email/login_password/login_phone`), §28 **KD-29**, **KD-42**; SoR §6 step 3; E5 §C.2 (`is_internal_ops()` used by 18 policies incl. `credit_funding_sessions` DELETE and `credit_payment_schedule` DELETE); E3 §1.1, §8.

## CURRENT BEHAVIOR (file:line)
- Prod: `is_internal_ops()` = `role ∈ {admin, internal_team, investor}` (E5 §C.2).
- Prod: `rental_ledger_investor_insert` / `rental_ledger_investor_update` policies exist (E3 §1.3).
- Prod: `insurance` has `login_email`, `login_password`, `login_phone`; 0 of 24 rows populated (boolean aggregate, E3 §1.1).
- App: `(admin)/interfaces/*` read `insurance` through `src/lib/queries.ts`; check whether any code selects the three columns (grep; E2 lists `/insurance` reading `insurance`).

## EXPECTED BEHAVIOR
- Staged migration `_staged/<ts>_internal_ops_investor_ledger_insurance_STAGED.sql`:
  1. `CREATE OR REPLACE FUNCTION public.is_internal_ops()` without `investor` (same signature, SECURITY DEFINER, same `search_path`).
  2. `DROP POLICY IF EXISTS rental_ledger_investor_insert`, `…_update` (read policy for investors stays: partners may read their own ledger lines; confirm the existing read policy name from the snapshot).
  3. `ALTER TABLE public.insurance DROP COLUMN IF EXISTS login_email, DROP COLUMN IF EXISTS login_password, DROP COLUMN IF EXISTS login_phone;` guarded by a pre-check that all three are empty (`RAISE EXCEPTION` if any non-null), so the migration refuses to destroy data.
  4. Idempotent; rollback SQL for 1 and 2 (3 is intentionally not reversible; state it).
- Rehearsal proving: an `investor` profile can no longer DELETE on `credit_funding_sessions`/`credit_payment_schedule` (via the 18 `is_internal_ops()` policies) or INSERT/UPDATE `rental_ledger`; `internal_team` and `admin` unchanged; the column drop aborts when a value is present.
- App code that references the three columns (if any) is removed in the same PR.

## FILES (in scope)
- NEW `supabase/migrations/_staged/<ts>_internal_ops_investor_ledger_insurance_STAGED.sql`
- NEW `scripts/tests/sql/internal-ops-investor.rehearsal.mjs` + fixture DDL
- Any `src/` reference to `insurance.login_*` (grep; remove)

## DATABASE ENTITIES
Function `is_internal_ops()`; policies on `rental_ledger`; columns on `insurance`. Read-only: the 18 dependent policies (list them in the PR from the snapshot).

## DEPENDENCIES
- TMMT-BUILD-003 snapshot (policy and function bodies).
- The credit tables are touched only through the shared helper; **tell the credit C1 owner** (their `credit-isolation.rehearsal.mjs` may assert investor behaviour).
- `/partner` uses RPC `get_partner_fleet` (E2 §1.3); confirm it does not rely on the investor write policies.

## CONSTRAINTS
- Not applied here. No data change.
- Do not touch `is_staff()` or `is_org_member()` (TMMT-DATA-003 / Phase 2A).

## SECURITY REQUIREMENTS
- Rehearsal includes a hostile authenticated user (no role) and an `investor` profile as the "downgraded" case.
- The migration never reads or prints column values; the pre-check is `count(*) where login_password is not null` only.

## IMPLEMENTATION NOTES
- `CREATE OR REPLACE` keeps the function OID so the 18 policies stay bound.
- Investor read on `rental_ledger` is a product requirement (partner view, SPEC §2.3 "keep narrow, read-only"); only the write policies go.

## ACCEPTANCE CRITERIA (testable)
1. Rehearsal pre-migration: investor can DELETE a fixture row on a table guarded by `is_internal_ops()` and INSERT into `rental_ledger`.
2. Post-migration: both denied; `internal_team` unchanged; `admin` unchanged.
3. Column-drop pre-check aborts on a fixture with one populated `login_password`, and succeeds on an empty one.
4. Migration runs twice cleanly.
5. PR lists the 18 dependent policies and the owner postcondition queries.

## TESTS (must fail on the pre-fix code)
- `internal-ops-investor.rehearsal.mjs`: `investor cannot delete via is_internal_ops policies` (fails pre-migration); `investor cannot write rental_ledger` (fails pre-migration); `column drop refuses non-empty`; `idempotent`.

## DO NOT CHANGE
- `is_staff()`, `is_org_member()`, `is_platform_admin()`; credit table policies themselves; `partner_fleet_access`; prod.

## OWNER GATE
**Prod baton** (owner applies after review). Column drop is destructive by nature; owner confirms the empty pre-check output before applying.
