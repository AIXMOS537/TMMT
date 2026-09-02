-- AIXMOS program cube — applications, audit, GHL intake (MVP RLS: tighten before public launch)

create type program_application_status as enum (
  'onboarding',
  'questionnaire_in_progress',
  'questionnaire_complete',
  'coach_reviewed',
  'advisor_reviewed',
  'admin_reviewed',
  'supervisor_approved',
  'client_consent_given',
  'submitted',
  'prepared_for_manual',
  'returned_for_corrections'
);

create type program_funding_track as enum ('personal', 'business', 'both');

create table program_applications (
  id uuid primary key default gen_random_uuid(),
  access_token uuid not null default gen_random_uuid(),
  ghl_contact_id text,
  email text not null,
  client_name text not null default '',
  track program_funding_track not null default 'personal',
  status program_application_status not null default 'onboarding',
  payload jsonb not null default '{}'::jsonb,
  overall_readiness int not null default 0,
  client_consent_given boolean not null default false,
  consent_timestamp timestamptz,
  submission_method text,
  submission_reference text,
  source text default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index program_applications_email_idx on program_applications (lower(email));
create index program_applications_ghl_contact_id_idx on program_applications (ghl_contact_id);
create index program_applications_status_idx on program_applications (status);

create table program_audit_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references program_applications(id) on delete cascade,
  actor_name text not null default 'System',
  actor_role text not null default 'admin',
  action text not null,
  from_status program_application_status,
  to_status program_application_status,
  notes text,
  created_at timestamptz not null default now()
);

create index program_audit_log_application_id_idx on program_audit_log (application_id);

create or replace function program_applications_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger program_applications_updated_at
  before update on program_applications
  for each row execute function program_applications_set_updated_at();

alter table program_applications enable row level security;
alter table program_audit_log enable row level security;

-- MVP: anon read/update for Realtime sync (replace with auth + policies before production hardening)
create policy "program_applications_anon_select"
  on program_applications for select to anon, authenticated using (true);

create policy "program_applications_anon_insert"
  on program_applications for insert to anon, authenticated with check (true);

create policy "program_applications_anon_update"
  on program_applications for update to anon, authenticated using (true);

create policy "program_audit_log_anon_select"
  on program_audit_log for select to anon, authenticated using (true);

create policy "program_audit_log_anon_insert"
  on program_audit_log for insert to anon, authenticated with check (true);

-- Realtime (idempotent)
do $$
begin
  alter publication supabase_realtime add table program_applications;
exception
  when duplicate_object then null;
end $$;
