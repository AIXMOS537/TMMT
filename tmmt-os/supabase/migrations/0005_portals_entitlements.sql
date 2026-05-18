-- Three-portal foundation: Client · Team · Admin
-- Roles = who you are. Entitlements = what you can access (package + manual grants).

do $$ begin
  create type public.portal_role as enum (
    'client', 'team_member', 'manager', 'admin', 'super_admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admin_scope as enum (
    'super', 'manager', 'finance', 'content'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.team_department as enum (
    'sales', 'support', 'training', 'ops', 'general'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- PACKAGES (Starter / Growth / Elite / Custom)
-- -----------------------------------------------------------------------------
create table if not exists public.packages (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  tier        smallint not null default 1,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- ENTITLEMENTS — apps, training, docs, support, billing, etc.
-- -----------------------------------------------------------------------------
create table if not exists public.entitlements (
  slug        text primary key,
  name        text not null,
  category    text not null default 'app',
  description text,
  portal      text not null default 'client',
  active      boolean not null default true
);

create table if not exists public.package_entitlements (
  package_id    uuid not null references public.packages(id) on delete cascade,
  entitlement_slug text not null references public.entitlements(slug) on delete cascade,
  primary key (package_id, entitlement_slug)
);

-- Manual overrides (custom clients, promos, admin grants)
create table if not exists public.profile_entitlement_grants (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  entitlement_slug  text not null references public.entitlements(slug) on delete cascade,
  granted_by        uuid references public.profiles(id) on delete set null,
  note              text,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  unique (profile_id, entitlement_slug)
);

-- -----------------------------------------------------------------------------
-- PROFILE PORTAL FIELDS
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists portal_role public.portal_role not null default 'client',
  add column if not exists admin_scope public.admin_scope,
  add column if not exists team_department public.team_department,
  add column if not exists package_id uuid references public.packages(id) on delete set null;

-- Map legacy ops roles → portal roles (safe to re-run)
update public.profiles set portal_role = 'super_admin', admin_scope = 'super'
  where role = 'admin' and portal_role = 'client';

update public.profiles set portal_role = 'team_member', team_department = 'ops'
  where role = 'internal_team' and portal_role = 'client';

update public.profiles set portal_role = 'team_member', team_department = 'general'
  where role = 'vendor' and portal_role = 'client';

update public.profiles set portal_role = 'client'
  where role in ('customer', 'investor') and portal_role = 'client';

-- -----------------------------------------------------------------------------
-- SEED PACKAGES & ENTITLEMENTS
-- -----------------------------------------------------------------------------
insert into public.packages (slug, name, tier, description) values
  ('starter', 'Starter', 1, 'Core apps, fundamentals training, support'),
  ('growth', 'Growth', 2, 'Expanded apps, document library, billing'),
  ('elite', 'Elite', 3, 'Full client portal access'),
  ('custom', 'Custom', 99, 'Manually assigned entitlements')
on conflict (slug) do nothing;

insert into public.entitlements (slug, name, category, portal) values
  ('app_a', 'App A', 'app', 'client'),
  ('app_b', 'App B', 'app', 'client'),
  ('training_fundamentals', 'Training · Fundamentals', 'training', 'client'),
  ('training_advanced', 'Training · Advanced', 'training', 'client'),
  ('docs_library', 'Documents library', 'document', 'client'),
  ('support_tickets', 'Support tickets', 'support', 'client'),
  ('billing_portal', 'Billing & package', 'billing', 'client'),
  ('announcements', 'Announcements', 'communication', 'client'),
  ('upgrade_center', 'Upgrade options', 'billing', 'client'),
  ('analytics_dashboard', 'Analytics dashboard', 'app', 'client'),
  ('onboarding_steps', 'Onboarding checklist', 'onboarding', 'client'),
  ('team_mission', 'Mission & roadmap', 'team', 'team'),
  ('team_training', 'Internal training', 'training', 'team'),
  ('team_sops', 'SOPs', 'document', 'team'),
  ('team_sales_scripts', 'Sales scripts', 'sales', 'team'),
  ('team_onboarding_process', 'Client onboarding process', 'process', 'team'),
  ('team_support_workflows', 'Support workflows', 'support', 'team'),
  ('team_tasks', 'Task assignments', 'ops', 'team'),
  ('team_announcements', 'Team announcements', 'communication', 'team'),
  ('team_performance', 'Performance dashboards', 'analytics', 'team'),
  ('admin_users', 'User management', 'admin', 'admin'),
  ('admin_packages', 'Package management', 'admin', 'admin'),
  ('admin_entitlements', 'Module access control', 'admin', 'admin'),
  ('admin_revenue', 'Revenue & subscriptions', 'admin', 'admin'),
  ('admin_client_activity', 'Client activity', 'admin', 'admin'),
  ('admin_team_activity', 'Team activity', 'admin', 'admin'),
  ('admin_documents', 'Uploaded documents', 'admin', 'admin'),
  ('admin_training_completion', 'Training completion', 'admin', 'admin'),
  ('admin_support_overview', 'Support overview', 'admin', 'admin'),
  ('admin_access_overrides', 'Manual access overrides', 'admin', 'admin')
on conflict (slug) do nothing;

-- Starter
insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug from public.packages p
cross join (values
  ('app_a'), ('training_fundamentals'), ('support_tickets'),
  ('announcements'), ('onboarding_steps')
) as e(slug) where p.slug = 'starter'
on conflict do nothing;

-- Growth = Starter + more
insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, pe.entitlement_slug from public.packages p
cross join public.package_entitlements pe
join public.packages sp on sp.id = pe.package_id and sp.slug = 'starter'
where p.slug = 'growth'
on conflict do nothing;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug from public.packages p
cross join (values ('app_b'), ('docs_library'), ('billing_portal')) as e(slug)
where p.slug = 'growth'
on conflict do nothing;

-- Elite = all client entitlements
insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug from public.packages p
cross join public.entitlements e
where p.slug = 'elite' and e.portal = 'client'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.packages enable row level security;
alter table public.entitlements enable row level security;
alter table public.package_entitlements enable row level security;
alter table public.profile_entitlement_grants enable row level security;

drop policy if exists packages_read on public.packages;
create policy packages_read on public.packages for select using (true);

drop policy if exists entitlements_read on public.entitlements;
create policy entitlements_read on public.entitlements for select using (true);

drop policy if exists package_entitlements_read on public.package_entitlements;
create policy package_entitlements_read on public.package_entitlements for select using (true);

drop policy if exists grants_self_read on public.profile_entitlement_grants;
create policy grants_self_read on public.profile_entitlement_grants for select
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists grants_admin_write on public.profile_entitlement_grants;
create policy grants_admin_write on public.profile_entitlement_grants for all
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- HELPERS
-- -----------------------------------------------------------------------------
create or replace function public.profile_portal_role()
returns public.portal_role
language sql stable security definer set search_path = public as $$
  select portal_role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select portal_role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  )
$$;
