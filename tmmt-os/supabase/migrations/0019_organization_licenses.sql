-- Organization-level license (lock-and-key): what modules this deploy / tenant purchased.
-- User entitlements (packages + grants) are intersected with org license in the app layer.

-- Some remote DBs have profiles.organization_id without this table (partial init).
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'tmmt',
  airtable_id text,
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table public.profiles
    add constraint profiles_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.license_tier as enum ('rentals_app', 'full_os', 'custom');
exception when duplicate_object then null; end $$;

create table if not exists public.organization_licenses (
  organization_id   uuid primary key references public.organizations(id) on delete cascade,
  license_tier      public.license_tier not null default 'rentals_app',
  modules           text[] not null default '{}',
  max_ventures      int not null default 1,
  license_key_hash  text,
  valid_until       timestamptz,
  provisioned_at    timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists organization_licenses_tier_idx
  on public.organization_licenses (license_tier);

alter table public.organization_licenses enable row level security;

drop policy if exists org_licenses_staff_read on public.organization_licenses;
create policy org_licenses_staff_read on public.organization_licenses
  for select using (public.is_staff());

drop policy if exists org_licenses_admin_write on public.organization_licenses;
create policy org_licenses_admin_write on public.organization_licenses
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Helpers for RLS (defense in depth)
-- -----------------------------------------------------------------------------

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.org_has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when ol.license_tier = 'full_os' then true
        when p_module = any (ol.modules) then true
        else false
      end
      from public.profiles p
      left join public.organization_licenses ol on ol.organization_id = p.organization_id
      where p.id = auth.uid()
      limit 1
    ),
    true
  );
$$;

-- -----------------------------------------------------------------------------
-- Seed TMMT HQ (full OS) and attach staff without an org
-- -----------------------------------------------------------------------------

insert into public.organizations (name, kind)
select 'TMMT HQ', 'tmmt'
where not exists (
  select 1 from public.organizations where name = 'TMMT HQ'
);

insert into public.organization_licenses (organization_id, license_tier, modules, max_ventures)
select
  o.id,
  'full_os',
  array['rentals_app', 'credit_repair', 'lease_to_own', 'operator_program']::text[],
  99
from public.organizations o
where o.name = 'TMMT HQ'
on conflict (organization_id) do update set
  license_tier = excluded.license_tier,
  modules = excluded.modules,
  max_ventures = excluded.max_ventures,
  updated_at = now();

update public.profiles p
set organization_id = o.id
from public.organizations o
where o.name = 'TMMT HQ'
  and p.organization_id is null
  and p.role in ('admin', 'internal_team');

-- -----------------------------------------------------------------------------
-- Journey / credit RLS: require org module (clients + staff)
-- -----------------------------------------------------------------------------

drop policy if exists credit_ack_own on public.credit_education_acknowledgments;
create policy credit_ack_own on public.credit_education_acknowledgments
  for all
  using (profile_id = auth.uid() and public.org_has_module('credit_repair'))
  with check (profile_id = auth.uid() and public.org_has_module('credit_repair'));

drop policy if exists credit_enroll_client on public.credit_enrollments;
create policy credit_enroll_client on public.credit_enrollments
  for select
  using (
    lower(customer_email) = lower(public.current_profile_email())
    and public.org_has_module('credit_repair')
  );

drop policy if exists credit_enroll_staff on public.credit_enrollments;
create policy credit_enroll_staff on public.credit_enrollments
  for all
  using (public.is_staff() and public.org_has_module('credit_repair'))
  with check (public.is_staff() and public.org_has_module('credit_repair'));

drop policy if exists lto_client on public.lto_agreements;
create policy lto_client on public.lto_agreements
  for select
  using (
    exists (
      select 1 from public.client_journey j
      where j.id = journey_id
        and lower(j.customer_email) = lower(public.current_profile_email())
    )
    and public.org_has_module('lease_to_own')
  );

drop policy if exists lto_staff on public.lto_agreements;
create policy lto_staff on public.lto_agreements
  for all
  using (public.is_staff() and public.org_has_module('lease_to_own'))
  with check (public.is_staff() and public.org_has_module('lease_to_own'));

drop policy if exists operator_profiles_staff on public.operator_profiles;
create policy operator_profiles_staff on public.operator_profiles
  for all
  using (public.is_staff() and public.org_has_module('operator_program'))
  with check (public.is_staff() and public.org_has_module('operator_program'));
