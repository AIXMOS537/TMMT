-- Client journey lifecycle: credit paths A/B/C, LTO, operators, training, good-standing

do $$ begin
  create type public.program_track as enum (
    'renter', 'credit', 'lto', 'operator_candidate', 'operator'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credit_path as enum (
    'monthly_97', 'payment_plan_500', 'mentorship_dfy_1000'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credit_plan_status as enum (
    'draft', 'active', 'paused', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delivery_mode as enum (
    'self_guided_training', 'done_for_you'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.operator_level as enum (
    'candidate', 'certified', 'senior', 'master'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vehicle_event_type as enum (
    'turnover', 'exchange', 'return_inspection', 'lto_start', 'lto_complete'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_type as enum (
    'rental_agreement', 'lto_purchase_agreement', 'vehicle_turnover',
    'vehicle_exchange', 'operator_license'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- CLIENT JOURNEY
-- -----------------------------------------------------------------------------
create table if not exists public.client_journey (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references public.profiles(id) on delete set null,
  customer_email    text not null,
  ghl_contact_id    text,
  program_track     public.program_track not null default 'renter',
  booking_id        uuid references public.bookings(id) on delete set null,
  vehicle_id        uuid,
  good_standing     boolean not null default false,
  good_standing_since timestamptz,
  good_standing_days integer not null default 0,
  lto_eligible      boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists client_journey_email_unique
  on public.client_journey (lower(customer_email));
create index if not exists client_journey_email_idx on public.client_journey(lower(customer_email));
create index if not exists client_journey_profile_idx on public.client_journey(profile_id);

-- -----------------------------------------------------------------------------
-- CHECKPOINTS
-- -----------------------------------------------------------------------------
create table if not exists public.journey_checkpoints (
  slug          text primary key,
  title         text not null,
  description   text,
  sort_order    smallint not null default 0,
  active        boolean not null default true
);

create table if not exists public.journey_checkpoint_events (
  id              uuid primary key default gen_random_uuid(),
  journey_id      uuid not null references public.client_journey(id) on delete cascade,
  checkpoint_slug text not null references public.journey_checkpoints(slug) on delete cascade,
  met_at          timestamptz not null default now(),
  evidence        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (journey_id, checkpoint_slug)
);

create index if not exists journey_checkpoint_events_journey_idx
  on public.journey_checkpoint_events(journey_id);

-- -----------------------------------------------------------------------------
-- CREDIT ENROLLMENTS & BILLING PLANS
-- -----------------------------------------------------------------------------
create table if not exists public.credit_enrollments (
  id              uuid primary key default gen_random_uuid(),
  journey_id      uuid not null references public.client_journey(id) on delete cascade,
  profile_id      uuid references public.profiles(id) on delete set null,
  customer_email  text not null,
  case_id         uuid references public.cases(id) on delete set null,
  status          text not null default 'active',
  delivery_mode   public.delivery_mode not null default 'self_guided_training',
  enrolled_at     timestamptz not null default now(),
  completed_at    timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists credit_enrollments_journey_idx on public.credit_enrollments(journey_id);

create table if not exists public.credit_billing_plans (
  id                uuid primary key default gen_random_uuid(),
  enrollment_id     uuid not null references public.credit_enrollments(id) on delete cascade,
  journey_id        uuid not null references public.client_journey(id) on delete cascade,
  credit_path       public.credit_path not null,
  status            public.credit_plan_status not null default 'active',
  is_add_on         boolean not null default false,
  delivery_mode     public.delivery_mode not null default 'self_guided_training',
  amount_cents      integer not null default 0,
  monthly_fee_cents integer,
  down_paid_cents   integer default 0,
  balance_due_cents integer default 0,
  next_billing_at   timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists credit_billing_plans_journey_idx on public.credit_billing_plans(journey_id);

-- At most one active base path (monthly_97 OR payment_plan_500) per journey
create unique index if not exists credit_billing_one_active_base
  on public.credit_billing_plans(journey_id)
  where status = 'active'
    and is_add_on = false
    and credit_path in ('monthly_97', 'payment_plan_500');

create table if not exists public.credit_payment_schedule (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.credit_billing_plans(id) on delete cascade,
  installment_no  smallint not null default 1,
  amount_cents    integer not null,
  due_at          timestamptz not null,
  paid_at         timestamptz,
  ledger_id       uuid references public.rental_ledger(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.credit_product_catalog (
  slug            text primary key,
  credit_path     public.credit_path not null,
  title           text not null,
  description     text,
  amount_cents    integer not null default 0,
  ghl_product_id  text,
  ghl_tag         text,
  active          boolean not null default true
);

-- -----------------------------------------------------------------------------
-- TRAINING & EDUCATION
-- -----------------------------------------------------------------------------
create table if not exists public.training_modules (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  summary       text,
  content_md    text,
  sort_order    smallint not null default 0,
  is_core       boolean not null default true,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.training_module_progress (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  module_id         uuid not null references public.training_modules(id) on delete cascade,
  percent_complete  smallint not null default 0 check (percent_complete between 0 and 100),
  completed_at      timestamptz,
  updated_at        timestamptz not null default now(),
  unique (profile_id, module_id)
);

create table if not exists public.credit_education_sections (
  id            text primary key,
  title         text not null,
  body_md       text not null,
  sort_order    smallint not null default 0,
  required      boolean not null default true,
  active        boolean not null default true
);

create table if not exists public.credit_education_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  section_id      text not null references public.credit_education_sections(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (profile_id, section_id)
);

-- -----------------------------------------------------------------------------
-- LTO, VEHICLE EVENTS, CONTRACTS
-- -----------------------------------------------------------------------------
create table if not exists public.lto_agreements (
  id              uuid primary key default gen_random_uuid(),
  journey_id      uuid not null references public.client_journey(id) on delete cascade,
  vehicle_id      uuid,
  vin             text,
  weekly_buyout_cents integer,
  term_weeks      integer,
  status          text not null default 'draft',
  signed_at       timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.vehicle_events (
  id              uuid primary key default gen_random_uuid(),
  journey_id      uuid references public.client_journey(id) on delete set null,
  booking_id      uuid references public.bookings(id) on delete set null,
  event_type      public.vehicle_event_type not null,
  old_vehicle_id  uuid,
  new_vehicle_id  uuid,
  case_id         uuid references public.cases(id) on delete set null,
  notes           text,
  metadata        jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table if not exists public.contract_instances (
  id              uuid primary key default gen_random_uuid(),
  journey_id      uuid not null references public.client_journey(id) on delete cascade,
  contract_type   public.contract_type not null,
  title           text not null,
  status          text not null default 'pending',
  document_id     uuid references public.documents(id) on delete set null,
  signed_at       timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- OPERATORS
-- -----------------------------------------------------------------------------
create table if not exists public.operator_profiles (
  id                  uuid primary key default gen_random_uuid(),
  journey_id          uuid unique references public.client_journey(id) on delete set null,
  profile_id          uuid references public.profiles(id) on delete set null,
  customer_email      text not null,
  level               public.operator_level not null default 'candidate',
  rubric_score        smallint not null default 0,
  revenue_share_pct   smallint not null default 35,
  license_fee_cents   integer not null default 0,
  ghl_pipeline_stage  text,
  certified_at        timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists operator_profiles_email_unique
  on public.operator_profiles (lower(customer_email));

create table if not exists public.operator_rubric_scores (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid not null references public.operator_profiles(id) on delete cascade,
  period_month      date not null,
  category_scores   jsonb not null default '{}'::jsonb,
  total_score       smallint not null default 0 check (total_score between 0 and 100),
  scored_by         uuid references public.profiles(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (operator_id, period_month)
);

create table if not exists public.revenue_splits (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references public.operator_profiles(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  gross_cents     integer not null default 0,
  platform_cents  integer not null default 0,
  operator_cents  integer not null default 0,
  status          text not null default 'pending',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- GOOD STANDING & LTO ELIGIBILITY
-- -----------------------------------------------------------------------------
create or replace function public.compute_good_standing(p_email text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_ok boolean := false;
begin
  if v_email is null or v_email = '' then
    return false;
  end if;

  select exists (
    select 1 from public.bookings b
    where lower(b.customer_email) = v_email
      and b.status in ('confirmed', 'active')
  ) into v_ok;
  if not v_ok then
    return false;
  end if;

  if exists (
    select 1 from public.rental_ledger rl
    where lower(rl.customer_email) = v_email
      and rl.entry_type = 'payment'
      and rl.status not in ('completed', 'cancelled')
      and rl.due_at is not null
      and rl.due_at < now()
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.client_renter_status crs
    where lower(crs.customer_email) = v_email
      and crs.canonical_stage in ('escalation', 'closed_lost')
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.cases c
    where lower(c.customer_email) = v_email
      and c.status = 'blocked'
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.credit_base_path_satisfied(p_journey_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.credit_billing_plans p
    where p.journey_id = p_journey_id
      and p.is_add_on = false
      and p.status = 'active'
      and p.credit_path = 'monthly_97'
      and (p.next_billing_at is null or p.next_billing_at >= now() - interval '45 days')
  )
  or exists (
    select 1 from public.credit_billing_plans p
    where p.journey_id = p_journey_id
      and p.is_add_on = false
      and p.credit_path = 'payment_plan_500'
      and p.status = 'completed'
      and p.paid_at is not null
  );
$$;

create or replace function public.credit_education_complete(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.credit_education_sections s
    where s.required = true and s.active = true
      and not exists (
        select 1 from public.credit_education_acknowledgments a
        where a.profile_id = p_profile_id and a.section_id = s.id
      )
  );
$$;

create or replace function public.training_core_complete(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.training_modules m
    where m.is_core = true and m.active = true
      and not exists (
        select 1 from public.training_module_progress p
        where p.profile_id = p_profile_id
          and p.module_id = m.id
          and p.percent_complete >= 100
          and p.completed_at is not null
      )
  );
$$;

create or replace function public.compute_lto_eligible(p_profile_id uuid, p_email text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_journey public.client_journey%rowtype;
begin
  select * into v_journey from public.client_journey
  where lower(customer_email) = lower(trim(p_email))
  limit 1;

  if v_journey.id is null then
    return false;
  end if;

  if not public.credit_base_path_satisfied(v_journey.id) then
    return false;
  end if;

  if p_profile_id is null or not public.credit_education_complete(p_profile_id) then
    return false;
  end if;

  if p_profile_id is null or not public.training_core_complete(p_profile_id) then
    return false;
  end if;

  if not exists (
    select 1 from public.journey_checkpoint_events e
    where e.journey_id = v_journey.id
      and e.checkpoint_slug = 'day_90_good_standing'
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.recompute_journey(p_email text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_journey_id uuid;
  v_profile_id uuid;
  v_gs boolean;
  v_gs_since timestamptz;
  v_days int;
  v_lto boolean;
begin
  if v_email is null or v_email = '' then
    return null;
  end if;

  select id into v_profile_id from public.profiles where lower(email) = v_email limit 1;

  select id into v_journey_id from public.client_journey where lower(customer_email) = v_email;
  if v_journey_id is null then
    insert into public.client_journey (customer_email, profile_id)
    values (v_email, v_profile_id)
    returning id into v_journey_id;
  else
    update public.client_journey
    set profile_id = coalesce(v_profile_id, profile_id), updated_at = now()
    where id = v_journey_id;
  end if;

  v_gs := public.compute_good_standing(v_email);

  select good_standing_since into v_gs_since
  from public.client_journey where id = v_journey_id;

  if v_gs then
    if v_gs_since is null then
      v_gs_since := now();
    end if;
    v_days := greatest(0, (now()::date - v_gs_since::date));
  else
    v_gs_since := null;
    v_days := 0;
  end if;

  update public.client_journey
  set good_standing = v_gs,
      good_standing_since = case when v_gs then coalesce(good_standing_since, now()) else null end,
      good_standing_days = v_days,
      updated_at = now()
  where id = v_journey_id;

  if v_gs and v_days >= 90 then
    insert into public.journey_checkpoint_events (journey_id, checkpoint_slug, evidence)
    values (v_journey_id, 'day_90_good_standing', jsonb_build_object('days', v_days))
    on conflict (journey_id, checkpoint_slug) do nothing;
  end if;

  v_lto := public.compute_lto_eligible(v_profile_id, v_email);

  update public.client_journey
  set lto_eligible = v_lto,
      program_track = case
        when v_lto and program_track = 'renter' then 'lto'::public.program_track
        else program_track
      end,
      updated_at = now()
  where id = v_journey_id;

  return v_journey_id;
end;
$$;

grant execute on function public.compute_good_standing(text) to authenticated, service_role;
grant execute on function public.compute_lto_eligible(uuid, text) to authenticated, service_role;
grant execute on function public.recompute_journey(text) to service_role;

-- -----------------------------------------------------------------------------
-- SEEDS
-- -----------------------------------------------------------------------------
insert into public.journey_checkpoints (slug, title, description, sort_order) values
  ('credit_education_acknowledged', 'Credit education complete', 'All required why-credit sections acknowledged', 10),
  ('credit_enrollment_active', 'Credit enrollment active', 'Path A or B base plan active', 20),
  ('training_path_started', 'Training started', 'At least one core module in progress', 30),
  ('training_core_complete', 'Core training complete', 'All core rebuild modules at 100%', 40),
  ('mentorship_dfy_active', 'Mentorship DFY active', 'Path C $1,000 paid', 50),
  ('day_90_good_standing', '90-day good standing', '90 consecutive days in good standing', 60),
  ('lto_eligible', 'LTO eligible', 'All gates met for lease-to-own', 70),
  ('vehicle_turnover_complete', 'Vehicle turnover complete', 'Turnover docs signed and vehicle swapped', 80)
on conflict (slug) do nothing;

insert into public.credit_product_catalog (slug, credit_path, title, description, amount_cents, ghl_tag) values
  ('path_a_monthly_97', 'monthly_97', 'Credit enrollment — up to $97/mo', 'Self-guided training included. Mutually exclusive with payment plan.', 9700, 'credit:monthly-97'),
  ('path_b_plan_500', 'payment_plan_500', 'Payment plan — $250 + $250', '$250 down + $250 within 30–45 days if not on $97/mo.', 50000, 'credit:plan-250-250'),
  ('path_c_mentorship_1000', 'mentorship_dfy_1000', 'Mentorship — Done for you', '$1,000 optional add-on after Path A or B.', 100000, 'credit:mentorship-dfy')
on conflict (slug) do nothing;

insert into public.credit_education_sections (id, title, body_md, sort_order) values
  ('why_credit_matters', 'Why credit repair matters', 'Your credit score affects rental rates, lease-to-own eligibility, and long-term wealth. TMMT requires a clear path to rebuild before LTO.', 1),
  ('why_rebuild', 'Why rebuilding now', 'Disputes, utilization, and payment habits compound over time. Starting during your rental puts you on track for ownership.', 2),
  ('rental_to_ownership', 'Rental → ownership', 'Active rental + credit path + training + 90 days good standing unlock lease-to-own. This portal tracks each gate.', 3)
on conflict (id) do nothing;

insert into public.training_modules (slug, title, summary, sort_order, is_core) values
  ('credit-basics', 'Credit basics', 'Scores, reports, and what lenders see.', 1, true),
  ('disputes-101', 'Disputes 101', 'How to identify errors and file disputes.', 2, true),
  ('utilization', 'Utilization & accounts', 'Balances, limits, and account mix.', 3, true),
  ('habits', 'Habits & maintenance', 'Ongoing habits to protect your score.', 4, true)
on conflict (slug) do nothing;

insert into public.entitlements (slug, name, category, portal) values
  ('credit_education_hub', 'Credit education hub', 'credit', 'client'),
  ('training_credit_rebuild', 'Credit rebuild training', 'training', 'client'),
  ('mentorship_dfy', 'Mentorship — Done for you', 'credit', 'client'),
  ('lto_hub', 'Lease-to-own hub', 'lto', 'client'),
  ('operator_candidate', 'Operator candidate portal', 'operator', 'client'),
  ('journey_path', 'My path', 'journey', 'client')
on conflict (slug) do nothing;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug
from public.packages p
cross join (values
  ('credit_education_hub'), ('training_credit_rebuild'), ('journey_path'),
  ('docs_library'), ('upgrade_center'), ('lto_hub')
) as e(slug)
where p.slug in ('growth', 'elite')
on conflict do nothing;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug
from public.packages p
cross join (values ('credit_education_hub'), ('journey_path')) as e(slug)
where p.slug = 'starter'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.client_journey enable row level security;
alter table public.journey_checkpoint_events enable row level security;
alter table public.credit_enrollments enable row level security;
alter table public.credit_billing_plans enable row level security;
alter table public.credit_payment_schedule enable row level security;
alter table public.training_module_progress enable row level security;
alter table public.credit_education_acknowledgments enable row level security;
alter table public.lto_agreements enable row level security;
alter table public.vehicle_events enable row level security;
alter table public.contract_instances enable row level security;
alter table public.operator_profiles enable row level security;
alter table public.operator_rubric_scores enable row level security;
alter table public.revenue_splits enable row level security;

-- Client journey read own email
drop policy if exists client_journey_client_read on public.client_journey;
create policy client_journey_client_read on public.client_journey for select
  using (lower(customer_email) = lower(public.current_profile_email()));

drop policy if exists client_journey_client_insert on public.client_journey;
create policy client_journey_client_insert on public.client_journey for insert
  with check (lower(customer_email) = lower(public.current_profile_email()));

drop policy if exists client_journey_staff on public.client_journey;
create policy client_journey_staff on public.client_journey for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists journey_events_client_read on public.journey_checkpoint_events;
create policy journey_events_client_read on public.journey_checkpoint_events for select
  using (exists (
    select 1 from public.client_journey j
    where j.id = journey_id
      and lower(j.customer_email) = lower(public.current_profile_email())
  ));

drop policy if exists journey_events_staff on public.journey_checkpoint_events;
create policy journey_events_staff on public.journey_checkpoint_events for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists credit_enroll_client on public.credit_enrollments;
create policy credit_enroll_client on public.credit_enrollments for select
  using (lower(customer_email) = lower(public.current_profile_email()));

drop policy if exists credit_enroll_staff on public.credit_enrollments;
create policy credit_enroll_staff on public.credit_enrollments for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists credit_plans_client on public.credit_billing_plans;
create policy credit_plans_client on public.credit_billing_plans for select
  using (exists (
    select 1 from public.client_journey j
    where j.id = journey_id
      and lower(j.customer_email) = lower(public.current_profile_email())
  ));

drop policy if exists credit_plans_staff on public.credit_billing_plans;
create policy credit_plans_staff on public.credit_billing_plans for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists training_progress_own on public.training_module_progress;
create policy training_progress_own on public.training_module_progress for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists training_progress_staff on public.training_module_progress;
create policy training_progress_staff on public.training_module_progress for select
  using (public.is_staff());

drop policy if exists credit_ack_own on public.credit_education_acknowledgments;
create policy credit_ack_own on public.credit_education_acknowledgments for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists credit_ack_staff on public.credit_education_acknowledgments;
create policy credit_ack_staff on public.credit_education_acknowledgments for select
  using (public.is_staff());

drop policy if exists lto_client on public.lto_agreements;
create policy lto_client on public.lto_agreements for select
  using (exists (
    select 1 from public.client_journey j
    where j.id = journey_id
      and lower(j.customer_email) = lower(public.current_profile_email())
  ));

drop policy if exists lto_staff on public.lto_agreements;
create policy lto_staff on public.lto_agreements for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists vehicle_events_client on public.vehicle_events;
create policy vehicle_events_client on public.vehicle_events for select
  using (exists (
    select 1 from public.client_journey j
    where j.id = journey_id
      and lower(j.customer_email) = lower(public.current_profile_email())
  ));

drop policy if exists vehicle_events_staff on public.vehicle_events;
create policy vehicle_events_staff on public.vehicle_events for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists contract_instances_client on public.contract_instances;
create policy contract_instances_client on public.contract_instances for select
  using (exists (
    select 1 from public.client_journey j
    where j.id = journey_id
      and lower(j.customer_email) = lower(public.current_profile_email())
  ));

drop policy if exists contract_instances_staff on public.contract_instances;
create policy contract_instances_staff on public.contract_instances for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists operator_profiles_client on public.operator_profiles;
create policy operator_profiles_client on public.operator_profiles for select
  using (lower(customer_email) = lower(public.current_profile_email()));

drop policy if exists operator_profiles_staff on public.operator_profiles;
create policy operator_profiles_staff on public.operator_profiles for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists operator_rubric_staff on public.operator_rubric_scores;
create policy operator_rubric_staff on public.operator_rubric_scores for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists revenue_splits_staff on public.revenue_splits;
create policy revenue_splits_staff on public.revenue_splits for all
  using (public.is_staff()) with check (public.is_staff());

-- Public read for catalog / modules / education sections
alter table public.journey_checkpoints enable row level security;
alter table public.credit_product_catalog enable row level security;
alter table public.training_modules enable row level security;
alter table public.credit_education_sections enable row level security;

drop policy if exists journey_checkpoints_read on public.journey_checkpoints;
create policy journey_checkpoints_read on public.journey_checkpoints for select using (true);

drop policy if exists credit_catalog_read on public.credit_product_catalog;
create policy credit_catalog_read on public.credit_product_catalog for select using (active = true);

drop policy if exists training_modules_read on public.training_modules;
create policy training_modules_read on public.training_modules for select using (active = true);

drop policy if exists credit_edu_sections_read on public.credit_education_sections;
create policy credit_edu_sections_read on public.credit_education_sections for select using (active = true);

grant select on public.journey_checkpoints to authenticated;
grant select on public.credit_product_catalog to authenticated;
grant select on public.training_modules to authenticated;
grant select on public.credit_education_sections to authenticated;
