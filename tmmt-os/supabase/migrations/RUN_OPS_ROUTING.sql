-- =============================================================================
-- OPS ROUTING — run AFTER RUN_CRM_SYNC_COMPLETE.sql (once)
-- Locations, work detection fields, dispatch loads, intake forms bootstrap
-- =============================================================================

do $$ begin
  create type public.case_type_enum as enum ('rental', 'dispatch', 'investor', 'general');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dispatch_load_status as enum (
    'available', 'assigned', 'picked_up', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

-- Per-location routing config (mirror in Airtable for you + systems engineer)
create table if not exists public.ops_locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  ghl_pipeline_id text,
  ghl_pipeline_name text,
  clickup_list_id text,
  overseas_assignee_email text,
  courier_prefs jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_locations_pipeline_idx on public.ops_locations(ghl_pipeline_name);

alter table public.cases
  add column if not exists case_type text not null default 'general',
  add column if not exists work_type text,
  add column if not exists routing_status text not null default 'pending',
  add column if not exists clickup_task_id text,
  add column if not exists clickup_task_url text,
  add column if not exists agent_draft jsonb not null default '{}'::jsonb,
  add column if not exists ops_location_id uuid references public.ops_locations(id) on delete set null,
  add column if not exists ghl_contact_id text,
  add column if not exists intake_id uuid;

alter table public.crm_sync_records
  add column if not exists work_type text,
  add column if not exists routing_status text not null default 'pending',
  add column if not exists clickup_task_id text,
  add column if not exists clickup_task_url text,
  add column if not exists agent_draft jsonb not null default '{}'::jsonb,
  add column if not exists ops_location_id uuid references public.ops_locations(id) on delete set null;

create table if not exists public.dispatch_loads (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  pickup text,
  dropoff text,
  window_start timestamptz,
  window_end timestamptz,
  weight_lbs numeric,
  rate_usd numeric,
  partner_courier text,
  status public.dispatch_load_status not null default 'available',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dispatch_loads_case_idx on public.dispatch_loads(case_id);
create index if not exists dispatch_loads_status_idx on public.dispatch_loads(status);

-- Anonymous intake (website / API) if not from 0001_init
create table if not exists public.customer_intake_forms (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  request_type text not null default 'other',
  subject text not null,
  details text,
  source text not null default 'web',
  airtable_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists ops_locations_set_updated on public.ops_locations;
create trigger ops_locations_set_updated
  before update on public.ops_locations
  for each row execute function public.set_updated_at();

drop trigger if exists dispatch_loads_set_updated on public.dispatch_loads;
create trigger dispatch_loads_set_updated
  before update on public.dispatch_loads
  for each row execute function public.set_updated_at();

alter table public.ops_locations enable row level security;
alter table public.dispatch_loads enable row level security;
alter table public.customer_intake_forms enable row level security;

drop policy if exists ops_locations_internal on public.ops_locations;
create policy ops_locations_internal on public.ops_locations
  for all using (public.is_internal_ops()) with check (public.is_internal_ops());

drop policy if exists dispatch_loads_internal on public.dispatch_loads;
create policy dispatch_loads_internal on public.dispatch_loads
  for all using (public.is_internal_ops()) with check (public.is_internal_ops());

drop policy if exists intake_public_insert on public.customer_intake_forms;
create policy intake_public_insert on public.customer_intake_forms
  for insert with check (true);

drop policy if exists intake_internal_read on public.customer_intake_forms;
create policy intake_internal_read on public.customer_intake_forms
  for select using (public.is_internal_ops());
