-- Paste this entire file into Supabase SQL Editor and run once.
-- Project: https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx/sql/new

-- === 0002_crm_sync.sql ===

do $$ begin
  create type public.canonical_renter_stage as enum (
    'inquiry','contacted','qualifying','payment_pending','booked',
    'pickup_scheduled','active_rental','return_due','returned',
    'extended','escalation','closed_won','closed_lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sync_record_status as enum (
    'pending_airtable',
    'pending_verification',
    'verified',
    'rejected',
    'error'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.crm_sync_records (
  id                  uuid primary key default gen_random_uuid(),
  business_line       text not null default 'rentals',
  ghl_contact_id      text not null,
  ghl_opportunity_id  text,
  ghl_pipeline_id     text,
  ghl_pipeline_name   text,
  ghl_stage           text not null,
  ghl_previous_stage  text,
  canonical_stage     public.canonical_renter_stage not null default 'inquiry',
  sync_status         public.sync_record_status not null default 'pending_airtable',
  airtable_table      text,
  airtable_record_id  text,
  case_id             uuid references public.cases(id) on delete set null,
  customer_name       text,
  customer_email      text,
  customer_phone      text,
  payload             jsonb not null default '{}'::jsonb,
  verified_at         timestamptz,
  verified_by         text,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id)
);

create index if not exists crm_sync_status_idx on public.crm_sync_records(sync_status);
create index if not exists crm_sync_ghl_contact_idx on public.crm_sync_records(ghl_contact_id);
create index if not exists crm_sync_canonical_idx on public.crm_sync_records(canonical_stage);

create table if not exists public.sync_events (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  event_type    text not null,
  external_id   text,
  sync_record_id uuid references public.crm_sync_records(id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,
  processed     boolean not null default false,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists sync_events_created_idx on public.sync_events(created_at desc);
create index if not exists sync_events_source_idx on public.sync_events(source, event_type);

create or replace function public.crm_sync_records_set_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_sync_records_updated on public.crm_sync_records;
create trigger crm_sync_records_updated
  before update on public.crm_sync_records
  for each row execute function public.crm_sync_records_set_updated();

alter table public.crm_sync_records enable row level security;
alter table public.sync_events enable row level security;

drop policy if exists crm_sync_internal_read on public.crm_sync_records;
create policy crm_sync_internal_read on public.crm_sync_records
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'internal_team', 'investor')
    )
  );

drop policy if exists sync_events_internal_read on public.sync_events;
create policy sync_events_internal_read on public.sync_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'internal_team')
    )
  );

-- === 0003_portal_renter_view.sql ===

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

comment on view public.renter_pipeline_status is
  'Lock app (Rentals Portal): one row per verified GHL sync — use canonical_stage for pipeline UI.';

grant select on public.renter_pipeline_status to authenticated;
