-- Hybrid TMMT DBs: cases exist without customer_intake_forms from 0001_init.
-- Required for /api/intake and /intake unified path (processUnifiedIntake).

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

create index if not exists intake_created_idx on public.customer_intake_forms(created_at desc);

alter table public.cases
  add column if not exists intake_id uuid references public.customer_intake_forms(id) on delete set null;

create index if not exists cases_intake_idx on public.cases(intake_id);

alter table public.customer_intake_forms enable row level security;

drop policy if exists intake_public_insert on public.customer_intake_forms;
create policy intake_public_insert on public.customer_intake_forms
  for insert with check (true);

drop policy if exists intake_internal_read on public.customer_intake_forms;
create policy intake_internal_read on public.customer_intake_forms
  for select using (public.is_internal_ops());
