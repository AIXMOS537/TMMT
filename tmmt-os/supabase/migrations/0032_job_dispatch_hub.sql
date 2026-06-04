-- Job Dispatch Hub — staff dispatch intake, protocol runs, partner app delivery

do $$ begin
  create type public.protocol_run_status as enum ('pending', 'running', 'completed', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_delivery_status as enum ('pending', 'delivered', 'failed', 'acknowledged');
exception when duplicate_object then null; end $$;

create table if not exists public.partner_app_endpoints (
  id uuid primary key default gen_random_uuid(),
  partner_app_slug text not null unique,
  webhook_url text not null,
  webhook_secret text,
  work_types text[] not null default '{}',
  case_types text[] not null default '{}',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_app_endpoints_active_idx
  on public.partner_app_endpoints (active) where active = true;

create table if not exists public.protocol_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  vendor_job_id uuid references public.vendor_jobs(id) on delete set null,
  protocol_id text not null,
  status public.protocol_run_status not null default 'pending',
  steps jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists protocol_runs_case_idx on public.protocol_runs (case_id);
create index if not exists protocol_runs_status_idx on public.protocol_runs (status);

create table if not exists public.job_dispatch_deliveries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  vendor_job_id uuid references public.vendor_jobs(id) on delete set null,
  partner_app_slug text not null,
  endpoint_id uuid references public.partner_app_endpoints(id) on delete set null,
  status public.job_delivery_status not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  response_status int,
  response_body text,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists job_dispatch_deliveries_case_idx on public.job_dispatch_deliveries (case_id);
create index if not exists job_dispatch_deliveries_app_idx on public.job_dispatch_deliveries (partner_app_slug);
create index if not exists job_dispatch_deliveries_status_idx on public.job_dispatch_deliveries (status);

drop trigger if exists partner_app_endpoints_set_updated on public.partner_app_endpoints;
create trigger partner_app_endpoints_set_updated
  before update on public.partner_app_endpoints
  for each row execute function public.set_updated_at();

alter table public.partner_app_endpoints enable row level security;
alter table public.protocol_runs enable row level security;
alter table public.job_dispatch_deliveries enable row level security;

drop policy if exists partner_app_endpoints_internal on public.partner_app_endpoints;
create policy partner_app_endpoints_internal on public.partner_app_endpoints
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'internal_team')
    )
  );

drop policy if exists protocol_runs_internal on public.protocol_runs;
create policy protocol_runs_internal on public.protocol_runs
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'internal_team')
    )
  );

drop policy if exists job_dispatch_deliveries_internal on public.job_dispatch_deliveries;
create policy job_dispatch_deliveries_internal on public.job_dispatch_deliveries
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'internal_team')
    )
  );

comment on table public.partner_app_endpoints is 'Webhook targets for partner vertical apps to receive TMMT OS jobs';
comment on table public.protocol_runs is 'Orchestrated protocol execution log per dispatch job';
comment on table public.job_dispatch_deliveries is 'Outbound job payloads delivered to partner apps';
