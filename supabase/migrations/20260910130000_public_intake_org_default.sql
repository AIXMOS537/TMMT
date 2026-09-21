-- The public intake layer could not write. This restores it.
--
-- 20260903185639_audit_hardening_20260903 revoked anon EXECUTE on acting_org_id()
-- and is_staff(). Its note reads "No RLS policy references them for anon/public."
-- That was true, and it was the wrong question: neither function is referenced by a
-- policy -- they are referenced by the DEFAULT expression on org_id. A default is
-- evaluated as the INSERTING role, so from 2026-09-03 every anonymous insert into
-- these tables failed with
--
--     42501  permission denied for function acting_org_id
--
-- on NINE tables that anon is explicitly allowed to insert into:
--
--   waitlist                        Join the Waitlist
--   incoming_leads                  Rent a car  (and every money CTA)
--   appointments                    Book an appointment
--   background_checks               Driver check
--   tickets                         Help / ticket
--   vehicle_handover                Handover
--   customer_inspection_photos      Inspection photos
--   credit_funding_sessions         Credit + funding intake
--   vehicle_onboarding_inspections  Onboarding inspection
--
-- Every public form of the rental business, silently refusing submissions while the
-- visitor was shown a success screen. incoming_leads has taken no row with
-- source='form' since 2026-07-21.
--
-- The fix keeps the hardening. anon still cannot call acting_org_id() or is_staff()
-- directly over REST -- those revokes stand. What anon gets instead is a narrow
-- SECURITY DEFINER wrapper returning only the org uuid a default needs, and nothing
-- about the caller's identity or staff status. The house-org uuid these return is
-- already visible in the table defaults themselves.

-- Shape 1: plain. Used where the default is COALESCE(acting_org_id(), house).
create or replace function public.default_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
$$;

-- Shape 2: staff-to-house. Used where the default reads
-- COALESCE(CASE WHEN is_staff() THEN NULL ELSE acting_org_id() END, house).
-- Same semantics, preserved exactly: a staff insert lands on the house org.
create or replace function public.default_org_id_staff_house()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    case when public.is_staff() then null else public.acting_org_id() end,
    '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
  )
$$;

revoke all on function public.default_org_id() from public;
revoke all on function public.default_org_id_staff_house() from public;
grant execute on function public.default_org_id() to anon, authenticated, service_role;
grant execute on function public.default_org_id_staff_house() to anon, authenticated, service_role;

-- Only the nine tables anon may actually insert into. Every other org_id default in
-- the schema sits on a staff-only table, where authenticated already has EXECUTE and
-- nothing is broken -- leaving those alone keeps this change to what is provably wrong.
alter table public.waitlist                       alter column org_id set default public.default_org_id();
alter table public.incoming_leads                 alter column org_id set default public.default_org_id();
alter table public.appointments                   alter column org_id set default public.default_org_id();
alter table public.background_checks              alter column org_id set default public.default_org_id();
alter table public.tickets                        alter column org_id set default public.default_org_id();
alter table public.vehicle_handover               alter column org_id set default public.default_org_id();
alter table public.customer_inspection_photos     alter column org_id set default public.default_org_id();
alter table public.credit_funding_sessions        alter column org_id set default public.default_org_id_staff_house();
alter table public.vehicle_onboarding_inspections alter column org_id set default public.default_org_id_staff_house();
