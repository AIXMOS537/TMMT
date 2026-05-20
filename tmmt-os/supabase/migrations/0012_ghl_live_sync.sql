-- GHL live sync: contacts, form submissions, appointments (webhook → Supabase → Vercel apps)

create table if not exists public.ghl_contacts (
  id              uuid primary key default gen_random_uuid(),
  ghl_contact_id  text not null unique,
  full_name       text,
  email           text,
  phone           text,
  tags            text[] not null default '{}',
  location_id     text,
  raw_payload     jsonb not null default '{}'::jsonb,
  synced_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ghl_contacts_email_idx on public.ghl_contacts (lower(email))
  where email is not null;

create table if not exists public.ghl_form_submissions (
  id                  uuid primary key default gen_random_uuid(),
  ghl_submission_id   text unique,
  ghl_contact_id      text,
  form_id             text,
  form_name           text,
  fields              jsonb not null default '{}'::jsonb,
  source              text not null default 'ghl',
  intake_id           uuid references public.customer_intake_forms(id) on delete set null,
  case_id             uuid references public.cases(id) on delete set null,
  raw_payload         jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists ghl_form_submissions_contact_idx
  on public.ghl_form_submissions (ghl_contact_id);
create index if not exists ghl_form_submissions_created_idx
  on public.ghl_form_submissions (created_at desc);

create table if not exists public.ghl_appointments (
  id                    uuid primary key default gen_random_uuid(),
  ghl_appointment_id    text not null unique,
  ghl_contact_id        text,
  title                 text,
  status                text,
  calendar_id           text,
  starts_at             timestamptz,
  ends_at               timestamptz,
  timezone              text,
  raw_payload           jsonb not null default '{}'::jsonb,
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists ghl_appointments_contact_idx on public.ghl_appointments (ghl_contact_id);
create index if not exists ghl_appointments_starts_idx on public.ghl_appointments (starts_at desc);

create or replace function public.ghl_contacts_set_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists ghl_contacts_updated on public.ghl_contacts;
create trigger ghl_contacts_updated
  before update on public.ghl_contacts
  for each row execute function public.ghl_contacts_set_updated();

create or replace function public.ghl_appointments_set_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists ghl_appointments_updated on public.ghl_appointments;
create trigger ghl_appointments_updated
  before update on public.ghl_appointments
  for each row execute function public.ghl_appointments_set_updated();

alter table public.ghl_contacts enable row level security;
alter table public.ghl_form_submissions enable row level security;
alter table public.ghl_appointments enable row level security;

drop policy if exists ghl_contacts_internal_read on public.ghl_contacts;
create policy ghl_contacts_internal_read on public.ghl_contacts
  for select to authenticated using (true);

drop policy if exists ghl_form_submissions_internal_read on public.ghl_form_submissions;
create policy ghl_form_submissions_internal_read on public.ghl_form_submissions
  for select to authenticated using (true);

drop policy if exists ghl_appointments_internal_read on public.ghl_appointments;
create policy ghl_appointments_internal_read on public.ghl_appointments
  for select to authenticated using (true);

grant select on public.ghl_contacts to authenticated;
grant select on public.ghl_form_submissions to authenticated;
grant select on public.ghl_appointments to authenticated;
