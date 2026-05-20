-- Tiered rental pricing (economy / mid / luxury) and insurance coverage workflows.
-- Apply after 0004_aixmos_ecosystem.sql and 0007_client_rental_hub.sql.

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.vehicle_tier as enum ('economy', 'mid', 'luxury');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.insurance_coverage_source as enum (
    'renter_own',
    'tmmt_internal',
    'corporate_non_owner',
    'pending'
  );
exception when duplicate_object then null; end $$;

-- Extend ledger for insurance premiums
do $$ begin
  alter type public.ledger_entry_type add value if not exists 'insurance_premium';
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- PRICING RULES — make / model / year matrix per tier
-- -----------------------------------------------------------------------------
create table if not exists public.rental_pricing_rules (
  id                  uuid primary key default gen_random_uuid(),
  tier                public.vehicle_tier not null,
  make                text,
  model               text,
  year_min            smallint,
  year_max            smallint,
  daily_rate_cents    integer not null,
  weekly_rate_cents   integer not null,
  deposit_cents       integer not null default 50000,
  match_priority      smallint not null default 0,
  active              boolean not null default true,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists rental_pricing_rules_tier_idx
  on public.rental_pricing_rules(tier, active, match_priority desc);

-- -----------------------------------------------------------------------------
-- INSURANCE PRODUCTS — internal premiums + corporate non-owner templates
-- -----------------------------------------------------------------------------
create table if not exists public.rental_insurance_products (
  id                          uuid primary key default gen_random_uuid(),
  tier                        public.vehicle_tier not null,
  coverage_source             public.insurance_coverage_source not null,
  name                        text not null,
  weekly_premium_cents        integer not null default 0,
  min_liability_cents         integer,
  requires_background_approved boolean not null default true,
  corporate_carrier_name      text,
  corporate_policy_template   text,
  active                      boolean not null default true,
  metadata                    jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  unique (tier, coverage_source)
);

-- -----------------------------------------------------------------------------
-- RENTAL INSURANCE SELECTIONS — per booking, gates lot release
-- -----------------------------------------------------------------------------
create table if not exists public.rental_insurance_selections (
  id                      uuid primary key default gen_random_uuid(),
  booking_id              uuid not null references public.bookings(id) on delete cascade,
  profile_id              uuid references public.profiles(id) on delete set null,
  customer_email          text not null,
  coverage_source         public.insurance_coverage_source not null default 'pending',
  policy_number           text,
  carrier_name            text,
  weekly_premium_cents    integer not null default 0,
  risk_score              smallint,
  background_check_status text,
  proof_document_path     text,
  corporate_policy_id     text,
  verified_at             timestamptz,
  verified_by             uuid references public.profiles(id) on delete set null,
  lot_release_approved    boolean not null default false,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (booking_id)
);

create index if not exists rental_insurance_selections_email_idx
  on public.rental_insurance_selections(lower(customer_email));

-- -----------------------------------------------------------------------------
-- VEHICLES + BOOKINGS extensions
-- -----------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists tier public.vehicle_tier,
  add column if not exists weekly_rate numeric(10, 2),
  add column if not exists fleet_vehicle_id uuid;

alter table public.bookings
  add column if not exists vehicle_tier public.vehicle_tier,
  add column if not exists quoted_daily_cents integer,
  add column if not exists quoted_weekly_cents integer,
  add column if not exists quoted_deposit_cents integer,
  add column if not exists pricing_rule_id uuid references public.rental_pricing_rules(id) on delete set null,
  add column if not exists insurance_coverage_source public.insurance_coverage_source default 'pending',
  add column if not exists insurance_verified boolean not null default false,
  add column if not exists lot_release_approved boolean not null default false;

-- -----------------------------------------------------------------------------
-- SEED — tier defaults + sample make/model rules
-- -----------------------------------------------------------------------------
insert into public.rental_pricing_rules (
  tier, make, model, year_min, year_max,
  daily_rate_cents, weekly_rate_cents, deposit_cents, match_priority
)
select * from (values
  ('economy'::public.vehicle_tier, null::text, null::text, null::smallint, null::smallint, 4500, 28000, 40000, 0::smallint),
  ('mid'::public.vehicle_tier, null::text, null::text, null::smallint, null::smallint, 7500, 47000, 50000, 0::smallint),
  ('luxury'::public.vehicle_tier, null::text, null::text, null::smallint, null::smallint, 15000, 95000, 100000, 0::smallint),
  ('economy'::public.vehicle_tier, 'Tesla', 'Model 3', 2020::smallint, null::smallint, 8900, 55000, 50000, 20::smallint),
  ('economy'::public.vehicle_tier, 'Tesla', 'Model Y', 2020::smallint, null::smallint, 9500, 59000, 50000, 20::smallint),
  ('mid'::public.vehicle_tier, 'BMW', '3 Series', 2018::smallint, null::smallint, 12000, 75000, 75000, 25::smallint),
  ('mid'::public.vehicle_tier, 'Mercedes-Benz', 'C-Class', 2018::smallint, null::smallint, 12500, 78000, 75000, 25::smallint),
  ('luxury'::public.vehicle_tier, 'Porsche', null::text, 2018::smallint, null::smallint, 22000, 140000, 150000, 30::smallint),
  ('luxury'::public.vehicle_tier, 'Mercedes-Benz', 'S-Class', 2018::smallint, null::smallint, 25000, 160000, 200000, 35::smallint),
  ('luxury'::public.vehicle_tier, 'BMW', '7 Series', 2018::smallint, null::smallint, 24000, 155000, 200000, 35::smallint)
) as v(tier, make, model, year_min, year_max, daily_rate_cents, weekly_rate_cents, deposit_cents, match_priority)
where not exists (select 1 from public.rental_pricing_rules limit 1);

insert into public.rental_insurance_products (
  tier, coverage_source, name, weekly_premium_cents, min_liability_cents,
  requires_background_approved, corporate_carrier_name, corporate_policy_template
) values
  ('economy', 'tmmt_internal', 'TMMT Economy Shield', 3500, 25000000, true, null, null),
  ('mid', 'tmmt_internal', 'TMMT Mid-Tier Protection', 5500, 50000000, true, null, null),
  ('luxury', 'tmmt_internal', 'TMMT Luxury Coverage', 9500, 100000000, true, null, null),
  ('economy', 'corporate_non_owner', 'Fleet Non-Owner (Economy)', 4200, 30000000, true, 'National Fleet Underwriters', 'NON_OWNER_ECONOMY'),
  ('mid', 'corporate_non_owner', 'Fleet Non-Owner (Mid)', 6200, 50000000, true, 'National Fleet Underwriters', 'NON_OWNER_MID'),
  ('luxury', 'corporate_non_owner', 'Fleet Non-Owner (Luxury)', 11000, 100000000, true, 'National Fleet Underwriters', 'NON_OWNER_LUXURY')
on conflict (tier, coverage_source) do nothing;

-- -----------------------------------------------------------------------------
-- RLS (staff read/write; clients read own insurance row via booking email)
-- -----------------------------------------------------------------------------
alter table public.rental_pricing_rules enable row level security;
alter table public.rental_insurance_products enable row level security;
alter table public.rental_insurance_selections enable row level security;

drop policy if exists "pricing_rules_public_read" on public.rental_pricing_rules;
create policy "pricing_rules_public_read" on public.rental_pricing_rules
  for select to anon, authenticated using (active = true);

drop policy if exists "insurance_products_public_read" on public.rental_insurance_products;
create policy "insurance_products_public_read" on public.rental_insurance_products
  for select to anon, authenticated using (active = true);

drop policy if exists "insurance_selections_staff_all" on public.rental_insurance_selections;
create policy "insurance_selections_staff_all" on public.rental_insurance_selections
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "insurance_selections_client_read" on public.rental_insurance_selections;
create policy "insurance_selections_client_read" on public.rental_insurance_selections
  for select to authenticated
  using (lower(customer_email) = lower(public.current_profile_email()));
