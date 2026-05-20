-- AIXMOS Supabase-ready schema (MVP reference — not wired in UI yet)

create type user_role as enum ('client', 'coach', 'admin', 'supervisor');
create type funding_track as enum ('personal', 'business', 'both');
create type application_status as enum (
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

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'client',
  onboarding_complete boolean default false,
  funding_track funding_track default 'personal',
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references profiles(id) not null,
  track funding_track not null,
  status application_status not null default 'onboarding',
  personal jsonb,
  business jsonb,
  overall_readiness int default 0,
  advisor_notes text,
  admin_notes text,
  supervisor_notes text,
  client_consent_given boolean default false,
  consent_timestamp timestamptz,
  submission_method text,
  submission_reference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  doc_key text not null,
  label text not null,
  required boolean default true,
  storage_path text,
  uploaded_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references profiles(id)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  actor_id uuid references profiles(id),
  actor_role user_role,
  action text not null,
  from_status application_status,
  to_status application_status,
  notes text,
  created_at timestamptz default now()
);

alter table applications enable row level security;
alter table audit_log enable row level security;
