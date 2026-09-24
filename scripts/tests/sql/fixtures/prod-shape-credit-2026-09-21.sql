-- =====================================================================
-- prod-shape.sql
-- READ-ONLY catalog capture of TMMT production (Supabase uapxakmlwnpfsftfeezx)
-- captured 2026-09-21 via pg_catalog / pg_policies / information_schema.
-- No row contents were read. Target: PostgreSQL 17 / PGlite rehearsal.
-- =====================================================================

-- =====================================================================
-- SECTION 0: STUBS (NOT production objects -- minimal stand-ins)
-- =====================================================================

-- STUB: Supabase API roles. service_role bypasses RLS like in Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

-- STUB: auth schema, auth.users (only id + email), auth.uid().
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

-- STUB: public.packages (FK target of profiles.package_id; out of scope).
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid()
);

-- =====================================================================
-- SECTION 1: ENUM TYPES (labels verbatim, in enumsortorder)
-- =====================================================================
create type public.user_role as enum ('admin', 'internal_team', 'investor', 'vendor', 'customer');
create type public.portal_role as enum ('client', 'team_member', 'manager', 'admin', 'super_admin');
create type public.admin_scope as enum ('super', 'manager', 'finance', 'content');
create type public.team_department as enum ('sales', 'support', 'training', 'ops', 'general');
create type public.org_vertical as enum ('rental', 'dealer', 'property', 'service_arbitrage');
create type public.partner_client_segment as enum ('retail', 'business_owner');
create type public.partner_revenue_split_tier as enum ('90_10', '80_20', '70_30', '60_40', '50_50');

-- =====================================================================
-- SECTION 2: TABLES
-- =====================================================================

-- public.organizations
create table public.organizations (
  id uuid not null default gen_random_uuid(),
  name text not null,
  kind text not null default 'tmmt'::text,
  airtable_id text,
  created_at timestamptz not null default now(),
  vertical public.org_vertical not null default 'rental'::public.org_vertical,
  parent_agency_id uuid,
  plan_tier text not null default 'starter'::text,
  billing_status text not null default 'trialing'::text,
  stripe_customer_id text,
  stripe_subscription_id text,
  suspended_at timestamptz,
  onboarding_step text default 'not_started'::text,
  onboarding_completed_at timestamptz,
  stripe_connect_account_id text,
  connect_charges_enabled boolean not null default false,
  agency_revenue_share_pct smallint not null default 80,
  partner_client_segment public.partner_client_segment,
  partner_revenue_split_tier public.partner_revenue_split_tier,
  partner_has_startup_capital boolean not null default false,
  partner_qualified_vehicle_count integer not null default 0,
  partner_split_auto_track boolean not null default true,
  partner_has_own_system boolean not null default false,
  partner_app_slug text,
  twilio_inbound_number text,
  agent_name text default 'Riley'::text,
  agent_persona_overlay jsonb not null default '{}'::jsonb,
  handoff_slack_webhook text,
  handoff_imessage_target text,
  cal_com_event_link text,
  llm_daily_cap_usd numeric not null default 50,
  constraint organizations_pkey primary key (id),
  constraint organizations_parent_agency_id_fkey foreign key (parent_agency_id) references public.organizations(id) on delete set null
);
create index organizations_agency_idx on public.organizations using btree (parent_agency_id);
create index organizations_stripe_customer_idx on public.organizations using btree (stripe_customer_id);
create unique index organizations_twilio_number_idx on public.organizations using btree (twilio_inbound_number) where (twilio_inbound_number is not null);

-- public.profiles
create table public.profiles (
  id uuid not null,
  email text,
  full_name text,
  phone text,
  role public.user_role not null default 'customer'::public.user_role,
  organization_id uuid,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  portal_role public.portal_role not null default 'client'::public.portal_role,
  admin_scope public.admin_scope,
  team_department public.team_department,
  package_id uuid,
  respond_capable boolean not null default false,
  responder_certs jsonb,
  telegram_chat_id text,
  is_certified boolean not null default false,
  affiliate_code text,
  unlock_status text,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete set null,
  constraint profiles_package_id_fkey foreign key (package_id) references public.packages(id) on delete set null
);
create index profiles_package_id_fkey_idx on public.profiles using btree (package_id);

-- public.org_roles
create table public.org_roles (
  org_id uuid not null,
  user_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  constraint org_roles_pkey primary key (org_id, user_id, role),
  constraint org_roles_role_check check ((role = any (array['tenant_admin'::text, 'dispatcher'::text, 'responder'::text, 'viewer'::text]))),
  constraint org_roles_org_id_fkey foreign key (org_id) references public.organizations(id) on delete cascade,
  constraint org_roles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);
create index org_roles_user_idx on public.org_roles using btree (user_id);

-- public.dispute_clients
create table public.dispute_clients (
  id text not null,
  client_name text,
  email text,
  source text not null,
  external_id text,
  payload jsonb not null,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dispute_clients_pkey primary key (id)
);
create index dispute_clients_email_idx on public.dispute_clients using btree (lower(email));
create index dispute_clients_updated_idx on public.dispute_clients using btree (updated_at desc);

-- =====================================================================
-- SECTION 3: HELPER FUNCTIONS (bodies verbatim from pg_get_functiondef)
-- Production EXECUTE: authenticated=true, anon=false, service_role=true
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select role = 'admin'
      or coalesce(portal_role::text, '') in ('admin', 'super_admin')
    from public.profiles where id = auth.uid()
  ), false)
$function$;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select role in ('admin', 'internal_team')
      or coalesce(portal_role::text, '') in ('team_member', 'manager', 'admin', 'super_admin')
    from public.profiles where id = auth.uid()
  ), false)
$function$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_internal_ops()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role::text in ('admin', 'internal_team', 'investor')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
      select 1 from public.org_roles
      where org_id = p_org_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and organization_id = p_org_id
        and role::text in ('admin', 'internal_team')
    );
$function$;

CREATE OR REPLACE FUNCTION public.current_profile_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select email from public.profiles where id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select role from public.profiles where id = auth.uid()
$function$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_internal_ops() from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.current_profile_email() from public;
revoke all on function public."current_role"() from public;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.is_internal_ops() to authenticated, service_role;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.current_profile_email() to authenticated, service_role;
grant execute on function public."current_role"() to authenticated, service_role;

-- =====================================================================
-- SECTION 4: TRIGGER FUNCTIONS + TRIGGERS (verbatim)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.dispute_clients_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
-- prod EXECUTE: anon=true, authenticated=true, service_role=true (default PUBLIC grant kept)

CREATE TRIGGER dispute_clients_set_updated_at BEFORE UPDATE ON public.dispute_clients FOR EACH ROW EXECUTE FUNCTION dispute_clients_touch_updated_at();

CREATE OR REPLACE FUNCTION public.profiles_block_protected_self_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  self_editable constant text[] := array['full_name', 'phone', 'updated_at'];
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'profiles: % cannot create profiles', current_user
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - self_editable) is distinct from (to_jsonb(old) - self_editable) then
    raise exception 'profiles: % may change only full_name and phone', current_user
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
-- prod EXECUTE: anon=false, authenticated=false, service_role=true
revoke all on function public.profiles_block_protected_self_edits() from public;
grant execute on function public.profiles_block_protected_self_edits() to service_role;

CREATE TRIGGER profiles_block_protected_self_edits BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_block_protected_self_edits();

-- =====================================================================
-- SECTION 5: RLS (prod: relrowsecurity=true, relforcerowsecurity=false on all four)
-- =====================================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_roles enable row level security;
alter table public.dispute_clients enable row level security;
-- (FORCE ROW LEVEL SECURITY is NOT set on any of the four in prod.)

-- =====================================================================
-- SECTION 6: POLICIES (expressions verbatim from pg_policies)
-- =====================================================================

-- dispute_clients
create policy dispute_clients_admin_only on public.dispute_clients
  as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

-- organizations
create policy organizations_select on public.organizations
  as permissive for select to authenticated
  using (((id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'internal_team'::user_role])))))));

-- org_roles
create policy self_read on public.org_roles
  as permissive for select to public
  using (((user_id = auth.uid()) OR is_staff()));

-- NOTE: tenant_admin_write is self-referential (subquery on org_roles inside an
-- org_roles policy). Kept verbatim; evaluating it as a non-bypass role raises
-- "infinite recursion detected in policy for relation org_roles".
create policy tenant_admin_write on public.org_roles
  as permissive for all to public
  using ((is_staff() OR (EXISTS ( SELECT 1
   FROM org_roles r
  WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text))))))
  with check ((is_staff() OR (EXISTS ( SELECT 1
   FROM org_roles r
  WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text))))));

-- profiles
create policy profiles_admin_all on public.profiles
  as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy profiles_self_read on public.profiles
  as permissive for select to public
  using (((id = ( SELECT auth.uid() AS uid)) OR is_staff() OR is_admin()));

create policy profiles_self_update on public.profiles
  as permissive for update to public
  using (((id = ( SELECT auth.uid() AS uid)) OR is_admin()))
  with check (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));

-- =====================================================================
-- SECTION 7: GRANTS (from information_schema.role_table_grants / column_privileges)
-- =====================================================================
-- dispute_clients: anon NONE; authenticated all-but-TRUNCATE; service_role ALL
revoke all on public.dispute_clients from anon, authenticated, service_role;
grant select, insert, update, delete, references, trigger on public.dispute_clients to authenticated;
grant all on public.dispute_clients to service_role;

-- organizations: anon + authenticated all-but-TRUNCATE; service_role ALL
revoke all on public.organizations from anon, authenticated, service_role;
grant select, insert, update, delete, references, trigger on public.organizations to anon, authenticated;
grant all on public.organizations to service_role;

-- org_roles: anon + authenticated all-but-TRUNCATE; service_role ALL
revoke all on public.org_roles from anon, authenticated, service_role;
grant select, insert, update, delete, references, trigger on public.org_roles to anon, authenticated;
grant all on public.org_roles to service_role;

-- profiles: anon SELECT; authenticated SELECT + column UPDATE(full_name, phone, updated_at); service_role ALL
revoke all on public.profiles from anon, authenticated, service_role;
grant select on public.profiles to anon;
grant select on public.profiles to authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- stub grants so FK checks / helper lookups behave
grant select on public.packages to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- =====================================================================
-- APPENDIX (comments only) -- production facts captured 2026-09-21
-- =====================================================================
-- Row counts (SELECT count(*)):
--   public.dispute_clients = 0
--   public.organizations   = 9
--   public.org_roles       = 1
--   public.profiles        = 3
--   storage.buckets        = 3
--   storage.objects where bucket_id='program-documents' = 0
--
-- storage.buckets (id | public | file_size_limit | allowed_mime_types):
--   program-documents | false | 12582912 | {image/jpeg,image/png,image/webp,application/pdf}
--   staff-documents   | false | null     | null
--   vehicle-media     | false | 10485760 | {image/jpeg,image/png,image/webp,image/heic,application/pdf}
--
-- storage.objects policies referencing 'program-documents' (pg_policies, verbatim):
--   policyname: program_documents_objects_staff
--   permissive: PERMISSIVE   roles: {authenticated}   cmd: ALL
--   qual:       ((bucket_id = 'program-documents'::text) AND (is_staff() OR is_platform_admin()))
--   with_check: ((bucket_id = 'program-documents'::text) AND (is_staff() OR is_platform_admin()))
--
-- Other prod facts:
--   relforcerowsecurity = false on all four tables.
--   Triggers enabled state = 'O' (origin) for both captured triggers.
--   profiles_block_protected_self_edits EXECUTE revoked from anon/authenticated in prod.
