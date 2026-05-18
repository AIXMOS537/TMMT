-- AIXMOS / TMMT ecosystem extensions — marketplace, payments, rewards, AI agent panel
-- Apply after 0001_init.sql (+ 0002_crm_sync.sql if using CRM sync portal).

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.agent_name as enum ('vision', 'tank', 'fly_guy', 'bob', 'sticks');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agent_vote as enum ('approve', 'reject', 'abstain');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum (
    'inquiry', 'quoted', 'confirmed', 'active', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'authorized', 'captured', 'failed', 'refunded'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- SERVICES — catalog (rentals, ops, education tiers)
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  category    text not null default 'rental',
  active      boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- VEHICLES — rental fleet
-- -----------------------------------------------------------------------------
create table if not exists public.vehicles (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  make         text,
  model        text,
  year         smallint,
  vin          text,
  plate        text,
  daily_rate   numeric(10, 2),
  active       boolean not null default true,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- BOOKINGS — rental / service reservations (optional link to cases)
-- -----------------------------------------------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  ref_code        text unique not null default ('B-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  profile_id      uuid references public.profiles(id) on delete set null,
  vehicle_id      uuid references public.vehicles(id) on delete set null,
  service_id      uuid references public.services(id) on delete set null,
  case_id         uuid references public.cases(id) on delete set null,
  customer_name   text not null,
  customer_email  text,
  customer_phone  text,
  status          public.booking_status not null default 'inquiry',
  starts_at       timestamptz,
  ends_at         timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_profile_idx on public.bookings(profile_id);

-- -----------------------------------------------------------------------------
-- PAYMENTS
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.bookings(id) on delete set null,
  case_id       uuid references public.cases(id) on delete set null,
  profile_id    uuid references public.profiles(id) on delete set null,
  amount_cents  integer not null,
  currency      text not null default 'usd',
  status        public.payment_status not null default 'pending',
  provider      text,
  external_id   text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments(booking_id);
create index if not exists payments_status_idx on public.payments(status);

-- -----------------------------------------------------------------------------
-- REWARDS — future token / points ledger
-- -----------------------------------------------------------------------------
create table if not exists public.rewards (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  points       integer not null default 0,
  source       text not null,
  reference_id text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists rewards_profile_idx on public.rewards(profile_id, created_at desc);

-- -----------------------------------------------------------------------------
-- AI AGENT EVALUATIONS — 3-of-5 approval panel (VISION, TANK, FLY GUY, BOB, STICKS)
-- -----------------------------------------------------------------------------
create table if not exists public.agent_evaluation_sessions (
  id                  uuid primary key default gen_random_uuid(),
  subject_type        text not null,
  subject_id          uuid not null,
  required_approvals  smallint not null default 3,
  panel_size          smallint not null default 5,
  status              text not null default 'pending',
  decision            text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

create index if not exists agent_sessions_subject_idx
  on public.agent_evaluation_sessions(subject_type, subject_id);

create table if not exists public.agent_evaluations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.agent_evaluation_sessions(id) on delete cascade,
  agent       public.agent_name not null,
  vote        public.agent_vote not null,
  rationale   text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (session_id, agent)
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.services                 enable row level security;
alter table public.vehicles                 enable row level security;
alter table public.bookings                 enable row level security;
alter table public.payments                 enable row level security;
alter table public.rewards                  enable row level security;
alter table public.agent_evaluation_sessions enable row level security;
alter table public.agent_evaluations        enable row level security;

-- services & vehicles: public read active; staff write
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select
  using (active = true or public.is_staff());
drop policy if exists services_staff_write on public.services;
create policy services_staff_write on public.services for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists vehicles_public_read on public.vehicles;
create policy vehicles_public_read on public.vehicles for select
  using (active = true or public.is_staff());
drop policy if exists vehicles_staff_write on public.vehicles;
create policy vehicles_staff_write on public.vehicles for all
  using (public.is_staff()) with check (public.is_staff());

-- bookings: staff all; customers read own
drop policy if exists bookings_staff_all on public.bookings;
create policy bookings_staff_all on public.bookings for all
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists bookings_self_read on public.bookings;
create policy bookings_self_read on public.bookings for select
  using (profile_id = auth.uid());

-- payments & rewards: staff read; users read own rewards
drop policy if exists payments_staff on public.payments;
create policy payments_staff on public.payments for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists rewards_staff on public.rewards;
create policy rewards_staff on public.rewards for select using (public.is_staff());
drop policy if exists rewards_self on public.rewards;
create policy rewards_self on public.rewards for select using (profile_id = auth.uid());

-- agent panel: staff read/write
drop policy if exists agent_sessions_staff on public.agent_evaluation_sessions;
create policy agent_sessions_staff on public.agent_evaluation_sessions for all
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists agent_votes_staff on public.agent_evaluations;
create policy agent_votes_staff on public.agent_evaluations for all
  using (public.is_staff()) with check (public.is_staff());

-- Seed starter catalog (safe to re-run)
insert into public.services (slug, name, description, category)
values
  ('rental-daily', 'Daily rental', 'TMMT vehicle rental — daily rate', 'rental'),
  ('rental-weekly', 'Weekly rental', 'TMMT vehicle rental — weekly rate', 'rental'),
  ('operator-onboarding', 'Operator onboarding', 'Guided setup for TMMT operators', 'education'),
  ('learn-fundamentals', 'TMMT fundamentals', 'Core ecosystem education module', 'education')
on conflict (slug) do nothing;
