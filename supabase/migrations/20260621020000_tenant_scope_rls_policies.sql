-- Tenant-scope RLS policies — org members read/write ONLY their org's rows.
-- Owner/staff bypass via is_staff() preserved on all paths.
--
-- STATUS: reviewable file for owner approval — NOT auto-applied.
-- Builds on org_id columns from 20260617_tenant_scope_core_tables (prod) and
-- acting_org_id() default fix (20260618210000_operator_writes_org_default.sql).
--
-- Idempotent: safe to re-run. Does NOT drop staff policies — org policies OR with them.

-- Helper: apply org-scoped SELECT + ALL policies when table has org_id column
create or replace function public._apply_org_member_rls(p_table text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $fn$
begin
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

revoke all on function public._apply_org_member_rls(text) from public;
grant execute on function public._apply_org_member_rls(text) to service_role;

-- Core customer + ops tables (same set as acting_org_id default list)
do $$
declare
  t text;
  tbls text[] := array[
    'active_customers','appointments','background_checks','bookings',
    'case_client_updates','case_status_history','clickup_tasks','client_alerts',
    'client_journey','contract_instances','contracts','credit_billing_plans',
    'credit_education_acknowledgments','credit_enrollments','credit_funding_sessions',
    'credit_payment_schedule','customer_inspection_photos','customer_payments',
    'deal_payments','do_not_rent_list','documents','expenses','fleet',
    'fleet_car_inspections','former_customers','insurance','incoming_leads',
    'journey_checkpoint_events','lto_agreements','maintenance_appointments',
    'operation_costs','operator_pipeline_tracker','operator_profiles',
    'partner_fleet_access','payments','program_applications','tickets',
    'training_module_progress','vehicle_handover','vehicle_onboarding_inspections',
    'vehicles','ventures','waitlist'
  ];
begin
  foreach t in array tbls loop
    perform public._apply_org_member_rls(t);
  end loop;
end $$;

-- Drop the helper — not needed at runtime after apply
drop function if exists public._apply_org_member_rls(text);

-- Verification queries (run manually after apply):
--   select tablename, policyname from pg_policies where policyname like 'org_member_%' order by 1;
--   -- As Moe Legacy operator: should see ONLY org_id = <moe org uuid> rows
--   -- As staff: should see all rows (is_staff bypass)
