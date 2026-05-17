-- =============================================================================
-- RUN THIS ENTIRE FILE ONCE in Supabase SQL Editor (in order, top to bottom).
-- Do NOT run the user_id RLS patch until this succeeds.
-- Project: uapxakmlwnpfsftfeezx
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Dependency: minimal cases table (required for case_id FK)
-- -----------------------------------------------------------------------------
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  ref_code text unique default (
    'C-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  request_type text not null default 'rental_booking',
  subject text not null default 'GHL sync',
  description text,
  status text not null default 'internal_review',
  metadata jsonb not null default '{}'::jsonb,
  airtable_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- B) CRM sync types + tables
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.canonical_renter_stage as enum (
    'inquiry','contacted','qualifying','payment_pending','booked',
    'pickup_scheduled','active_renter','return_due','returned',
    'extended','escalation','closed_won','closed_lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sync_record_status as enum (
    'pending_airtable','pending_verification','verified','rejected','error'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.crm_sync_records (
  id uuid primary key default gen_random_uuid(),
  business_line text not null default 'rentals',
  ghl_contact_id text not null,
  ghl_opportunity_id text,
  ghl_pipeline_id text,
  ghl_pipeline_name text,
  ghl_stage text not null,
  ghl_previous_stage text,
  canonical_stage public.canonical_renter_stage not null default 'inquiry',
  sync_status public.sync_record_status not null default 'pending_airtable',
  airtable_table text,
  airtable_record_id text,
  case_id uuid references public.cases(id) on delete set null,
  customer_name text,
  customer_email text,
  customer_phone text,
  payload jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  verified_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id)
);

create index if not exists crm_sync_status_idx on public.crm_sync_records(sync_status);
create index if not exists crm_sync_ghl_contact_idx on public.crm_sync_records(ghl_contact_id);

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  external_id text,
  sync_record_id uuid references public.crm_sync_records(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- C) updated_at trigger (auto-maintain crm_sync_records.updated_at)
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_sync_records_set_updated on public.crm_sync_records;
create trigger crm_sync_records_set_updated
  before update on public.crm_sync_records
  for each row execute function public.set_updated_at();

drop trigger if exists cases_set_updated on public.cases;
create trigger cases_set_updated
  before update on public.cases
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- D) RLS — internal ops team (NOT per-user user_id; GHL webhooks use service role)
-- Webhooks bypass RLS. Logged-in staff read the queue via policies below.
-- -----------------------------------------------------------------------------
alter table public.crm_sync_records enable row level security;
alter table public.sync_events enable row level security;
alter table public.cases enable row level security;

-- Helper: true if profiles exists and user is internal (else allow all authenticated for bootstrap)
create or replace function public.is_internal_ops()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if to_regclass('public.profiles') is null then
    return true;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('admin', 'internal_team', 'investor')
  );
exception when others then
  return true;
end;
$$;

drop policy if exists crm_sync_internal_read on public.crm_sync_records;
create policy crm_sync_internal_read on public.crm_sync_records
  for select to authenticated
  using (public.is_internal_ops());

drop policy if exists crm_sync_internal_update on public.crm_sync_records;
create policy crm_sync_internal_update on public.crm_sync_records
  for update to authenticated
  using (public.is_internal_ops())
  with check (public.is_internal_ops());

drop policy if exists sync_events_internal_read on public.sync_events;
create policy sync_events_internal_read on public.sync_events
  for select to authenticated
  using (public.is_internal_ops());

drop policy if exists cases_internal_read on public.cases;
create policy cases_internal_read on public.cases
  for select to authenticated
  using (public.is_internal_ops());

drop policy if exists cases_internal_update on public.cases;
create policy cases_internal_update on public.cases
  for update to authenticated
  using (public.is_internal_ops())
  with check (public.is_internal_ops());

-- -----------------------------------------------------------------------------
-- E) Portal view (inherits RLS from crm_sync_records)
-- -----------------------------------------------------------------------------
create or replace view public.renter_pipeline_status as
select
  r.id as sync_record_id,
  r.ghl_contact_id,
  r.ghl_opportunity_id,
  r.ghl_pipeline_name,
  r.ghl_stage,
  r.canonical_stage,
  r.business_line,
  r.customer_name,
  r.customer_email,
  r.customer_phone,
  r.case_id,
  r.airtable_record_id,
  r.verified_at,
  r.updated_at
from public.crm_sync_records r
where r.sync_status = 'verified';

grant select on public.renter_pipeline_status to authenticated;
