-- P0 SECURITY REMEDIATION — is_internal_ops() must fail CLOSED.
--
-- THE DEFECT
-- The live function is plpgsql and grants authority on failure:
--
--   begin
--     if to_regclass('public.profiles') is null then
--       return true;                  -- ← grants on missing dependency
--     end if;
--     return exists (... role in ('admin','internal_team','investor'));
--   exception when others then
--     return true;                    -- ← grants on ANY error
--   end;
--
-- Any exception inside the predicate - a permissions error, a type error, a
-- search_path problem, a transient failure - returns TRUE and grants
-- internal-ops authority. Every sibling helper (is_staff, is_platform_admin,
-- is_org_member) is LANGUAGE sql and fails closed. This one was the exception,
-- in the wrong direction.
--
-- BLAST RADIUS (verified 2026-09-08): 18 policies across 8 tables, not one.
--   cases                    SELECT, UPDATE
--   credit_funding_sessions  SELECT, UPDATE, DELETE
--   credit_payment_schedule  SELECT, INSERT, UPDATE, DELETE
--   crm_sync_records         SELECT, UPDATE
--   customer_intake_forms    SELECT   ← policy applies to role {public}
--   program_applications     SELECT, INSERT, UPDATE, DELETE
--   program_audit_log        SELECT
--   sync_events              SELECT
--
-- customer_intake_forms is the sharpest edge: its policy targets {public}, so
-- the fail-open path sat behind an anonymous-reachable policy on intake PII.
-- Two DELETE policies (credit_payment_schedule, program_applications) were also
-- gated solely on this predicate.
--
-- THE INVARIANT
--   UNCERTAIN AUTHORIZATION = DENY.
-- An authorization helper must never grant authority because something failed.
--
-- THE CORRECTION
-- Rewrite as LANGUAGE sql with no exception handler, matching the established
-- shape of is_staff() / is_platform_admin() / is_org_member() exactly. A SQL
-- function cannot swallow an error into a TRUE: a failure propagates and the
-- policy denies. `select exists(...)` yields false - never null - when no row
-- matches, and auth.uid() being null simply matches nothing.
--
-- SCOPE
-- Behaviour for legitimately authorized users is unchanged. The 'investor' role
-- is PRESERVED deliberately: no product requirement establishes it is wrong, so
-- removing it here would be an unreviewed behaviour change. It is flagged for
-- separate decision - see docs/saas/TENANT_ISOLATION_TEST_MATRIX.md.
--
-- Policies are NOT touched. Only the predicate changes.

create or replace function public.is_internal_ops()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role::text in ('admin', 'internal_team', 'investor')
  );
$$;

comment on function public.is_internal_ops() is
  'Internal-ops authority predicate. FAILS CLOSED by construction: LANGUAGE sql '
  'with no exception handler, so any error propagates and the calling policy '
  'denies. Do not reintroduce plpgsql exception handling here - a predicate that '
  'returns true on failure grants authority on failure. Gates 18 policies across '
  '8 tables including a {public} policy on customer_intake_forms.';

-- VERIFICATION (read-only, run after applying):
--
--   select prolang.lanname, p.prosecdef, p.provolatile
--     from pg_proc p
--     join pg_language prolang on prolang.oid = p.prolang
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'is_internal_ops';
--   -- expect: sql | t | s
--
--   select pg_get_functiondef(p.oid) ilike '%exception%' as has_exception_handler
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.proname='is_internal_ops';
--   -- expect: false
