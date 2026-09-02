-- App-layer tenancy unlock: make non-staff OPERATOR writes succeed.
--
-- Problem (from UNISON-AND-HANDOFF.md): every org-scoped table defaults org_id to
-- the TMMT RENTALS home org. Owner/staff writes pass via is_staff(); but a non-staff
-- operator (Moe Legacy, Khan Strategies, …) inserting a row WITHOUT an explicit
-- org_id gets org_id = home, which fails the WITH CHECK
--   is_staff() OR (org_id IS NOT NULL AND is_org_member(org_id))
-- because they are not a member of the home org → write rejected ("fails closed").
--
-- Fix (single, bulletproof, covers EVERY write path — app actions, scripts, RPCs —
-- so no insert site can be missed): change the org_id DEFAULT so that:
--   * staff/owner          → NULL → coalesce → home  (behaviour unchanged)
--   * non-staff org member → their own org           (write now passes WITH CHECK)
-- Explicit org_id values are still honoured. RLS WITH CHECK is unchanged and remains
-- the real fence, so this cannot create cross-tenant writes — it only stops the
-- self-inflicted fail-closed on an operator's OWN org.
--
-- Idempotent. Builds on 20260617_tenant_scope_core_tables.sql et al.

-- Resolve the acting user's org from org_roles. Prefers a non-home org so the owner
-- (member of home + AIXMOS) is handled by the is_staff() branch below, not here.
create or replace function public.acting_org_id()
returns uuid
language sql
stable
security definer
set search_path = 'public'
as $$
  select r.org_id
  from public.org_roles r
  where r.user_id = auth.uid()
  order by (r.org_id = '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid) asc  -- non-home first
  limit 1
$$;

revoke all on function public.acting_org_id() from public, anon;
grant execute on function public.acting_org_id() to authenticated, service_role;

do $$
declare
  home uuid := '8e651b25-e7c8-4356-af64-1716a82053b0';  -- TMMT RENTALS
  t text;
  tbls text[] := array[
   'active_customers','agent_evaluation_sessions','agent_evaluations','appointments',
   'background_checks','bookings','case_client_updates','case_status_history','clickup_tasks',
   'client_alerts','client_journey','contract_instances','contracts','coo_briefings',
   'credit_billing_plans','credit_education_acknowledgments','credit_enrollments',
   'credit_funding_sessions','credit_payment_schedule','customer_inspection_photos',
   'customer_payments','deal_payments','do_not_rent_list','documents','expenses','fleet',
   'fleet_car_inspections','former_customers','insurance','journey_checkpoint_events',
   'lto_agreements','maintenance_appointments','marketing_kpi_weeks','marketplace_listings',
   'operation_costs','operator_pipeline_tracker','operator_profiles','operator_rubric_scores',
   'partner_fleet_access','payments','program_applications','rental_insurance_selections',
   'rewards','services','shops_mechanics_cleaning','tickets','time_clock_entries',
   'training_module_progress','vehicle_damage_reports','vehicle_events','vehicle_handover',
   'vehicle_media','vehicle_onboarding_inspections','vehicles','vendor_files',
   'vendor_job_updates','vendor_jobs','ventures','waitlist',
   -- also scoped later in 20260617_tenant_scope_referrals_and_pricing.sql:
   'partner_referrals','rental_pricing_rules'
  ];
begin
  foreach t in array tbls loop
    -- Only touch tables that actually got an org_id column from the tenancy migrations.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'org_id'
    ) then
      execute format(
        'alter table public.%I alter column org_id set default '
        || 'coalesce(case when public.is_staff() then null else public.acting_org_id() end, %L::uuid)',
        t, home);
    end if;
  end loop;
end $$;
