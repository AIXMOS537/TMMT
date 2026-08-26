-- RLS gap-fill: tables that got an org_id DEFAULT wired in
-- 20260618210000_operator_writes_org_default.sql (so they DO carry an org_id
-- column) but were never added to the SELECT/write policy list in
-- 20260621020000_tenant_scope_rls_policies.sql — meaning even once that
-- migration is approved and applied, these tables would still have zero
-- read/write RLS policies (or, for credit_funding_sessions, a policy so broad
-- it defeats tenant isolation). Found via migration-history audit, 2026-08-22.
--
-- STATUS: reviewable file for owner approval — NOT auto-applied (same posture
-- as 20260621020000_tenant_scope_rls_policies.sql and
-- 20260628000000_is_staff_fail_closed.sql).
--
-- Purely additive: does not edit any existing migration file. Mirrors the
-- exact org-scoped select/insert/update/delete pattern already in production
-- use (20260621020000_tenant_scope_rls_policies.sql) rather than inventing a
-- new policy shape. Idempotent and safe to re-run; every ALTER/CREATE POLICY
-- is guarded so it is also a no-op on any environment where a listed table
-- does not exist or has no org_id column (e.g. local/dev DBs that never ran
-- the untracked 20260617_tenant_scope_core_tables.sql that originally added
-- these org_id columns in prod — see audit notes for that gap).

-- Helper: apply org-scoped SELECT + ALL policies when table has org_id column.
-- Re-declared here (not reused from 20260621020000) because that migration
-- drops its own copy of this function at the end of its file — this migration
-- must work standalone whether or not 20260621020000 has been applied yet.
create or replace function public._apply_org_member_rls_2(p_table text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $fn$
begin
  if to_regclass('public.' || p_table) is null then
    raise notice 'skip % — table does not exist', p_table;
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'org_id'
  ) then
    raise notice 'skip % — no org_id column', p_table;
    return;
  end if;

  execute format('alter table public.%I enable row level security', p_table);

  execute format('drop policy if exists org_member_read on public.%I', p_table);
  execute format(
    'create policy org_member_read on public.%I for select to authenticated '
    || 'using (public.is_staff() or public.is_org_member(org_id))',
    p_table
  );

  execute format('drop policy if exists org_member_write on public.%I', p_table);
  execute format(
    'create policy org_member_write on public.%I for all to authenticated '
    || 'using (public.is_staff() or public.is_org_member(org_id)) '
    || 'with check (public.is_staff() or (org_id is not null and public.is_org_member(org_id)))',
    p_table
  );
end;
$fn$;

revoke all on function public._apply_org_member_rls_2(text) from public;
grant execute on function public._apply_org_member_rls_2(text) to service_role;

-- Tables present in the operator_writes_org_default.sql org_id-default array
-- but absent from the tenant_scope_rls_policies.sql apply-list. Ranked by
-- sensitivity in the accompanying audit report; all get the same tenant-scope
-- treatment since the scoping mechanism (org_id + is_org_member) is identical
-- and already proven in production for the sibling tables.
do $$
declare
  t text;
  tbls text[] := array[
    'coo_briefings',              -- internal exec briefings — high sensitivity
    'operator_rubric_scores',     -- internal operator performance/HR-adjacent
    'rental_insurance_selections',-- customer insurance selection data
    'partner_referrals',          -- referral + commission tracking (financial)
    'rental_pricing_rules',       -- competitive/business-sensitive pricing config
    'vehicle_damage_reports',     -- customer/vehicle liability data
    'marketplace_listings',       -- org-scoped business listings
    'agent_evaluation_sessions',  -- internal AI agent eval data
    'agent_evaluations',
    'marketing_kpi_weeks',        -- internal analytics
    'vehicle_events',             -- vehicle telemetry/event log
    'vehicle_media',              -- vehicle photos/media
    'rewards',                    -- customer loyalty/points (financial-adjacent)
    'services'                    -- org service catalog
  ];
begin
  foreach t in array tbls loop
    perform public._apply_org_member_rls_2(t);
  end loop;
end $$;

drop function if exists public._apply_org_member_rls_2(text);

-- credit_funding_sessions: RLS has been ON since 20260608120000, but the only
-- non-anon policy is "auth_all_credit_funding" — FOR ALL TO authenticated
-- USING (true). That grants every authenticated user (any operator, vendor,
-- investor login — not just staff) read/write on every org's funding-readiness
-- sessions. Postgres RLS policies are permissive/OR'd, so simply adding an
-- org-scoped policy later (as 20260621020000 proposes) would NOT fix this —
-- the old USING(true) policy stays active alongside it and still allows
-- everything. Drop it here and replace with the same staff-or-own-org pattern
-- used everywhere else. anon INSERT (the public discovery-session capture) is
-- untouched — that stays intentional and unchanged.
drop policy if exists "auth_all_credit_funding" on public.credit_funding_sessions;

do $$
begin
  if to_regclass('public.credit_funding_sessions') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'credit_funding_sessions'
         and column_name = 'org_id'
     )
  then
    execute 'drop policy if exists org_member_read on public.credit_funding_sessions';
    execute
      'create policy org_member_read on public.credit_funding_sessions for select to authenticated '
      || 'using (public.is_staff() or public.is_org_member(org_id))';

    execute 'drop policy if exists org_member_write on public.credit_funding_sessions';
    execute
      'create policy org_member_write on public.credit_funding_sessions for all to authenticated '
      || 'using (public.is_staff() or public.is_org_member(org_id)) '
      || 'with check (public.is_staff() or (org_id is not null and public.is_org_member(org_id)))';
  else
    -- No org_id column yet in this environment: fall back to staff-only so we
    -- never leave the table with RLS on and zero non-anon policies (which
    -- would fail-closed for staff too) nor with the old USING(true) hole.
    execute 'drop policy if exists staff_all_credit_funding on public.credit_funding_sessions';
    execute
      'create policy staff_all_credit_funding on public.credit_funding_sessions for all to authenticated '
      || 'using (public.is_staff()) with check (public.is_staff())';
    raise notice 'credit_funding_sessions has no org_id column yet — applied staff-only policy as interim fix';
  end if;
end $$;

-- Verification queries (run manually after apply):
--   select tablename, policyname, cmd from pg_policies
--   where tablename in (
--     'coo_briefings','operator_rubric_scores','rental_insurance_selections',
--     'partner_referrals','rental_pricing_rules','vehicle_damage_reports',
--     'marketplace_listings','agent_evaluation_sessions','agent_evaluations',
--     'marketing_kpi_weeks','vehicle_events','vehicle_media','rewards',
--     'services','credit_funding_sessions'
--   ) order by 1, 2;
--   -- Confirm "auth_all_credit_funding" no longer appears anywhere.
--   -- As a non-staff org member: should see ONLY their own org_id rows on
--   -- each table above. As staff: full access (is_staff bypass).
