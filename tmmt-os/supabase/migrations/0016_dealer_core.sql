-- Dealer vertical: organization flag + canonical deal desk (parties / deals / payments)
-- Apply after 0015_journey_starter_entitlements.sql

do $$ begin
  create type public.org_vertical as enum ('rental', 'dealer');
exception when duplicate_object then null; end $$;

alter table public.organizations
  add column if not exists vertical public.org_vertical not null default 'rental';

comment on column public.organizations.vertical is
  'Operating vertical: rental (TMMT fleet) or dealer (independent lot / BHPH).';

-- -----------------------------------------------------------------------------
-- PARTIES — buyers, co-buyers, guarantors (dealer); maps from rental "customers"
-- -----------------------------------------------------------------------------
create table if not exists public.parties (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  full_name        text not null,
  email            text,
  phone            text,
  party_type       text not null default 'buyer',
  lead_id          uuid,
  notes            text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists parties_org_idx on public.parties(organization_id);
create index if not exists parties_email_idx on public.parties(lower(email));

-- -----------------------------------------------------------------------------
-- DEALS — retail / BHPH desk record (links command-center fleet by UUID)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.deal_status as enum (
    'working', 'pending', 'sold', 'funded', 'cancelled'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.deals (
  id                    uuid primary key default gen_random_uuid(),
  ref_code              text unique not null default ('D-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  party_id              uuid references public.parties(id) on delete set null,
  fleet_vehicle_id      uuid,
  vehicle_label         text,
  vin                   text,
  status                public.deal_status not null default 'working',
  sale_price            numeric(12, 2),
  trade_in_value        numeric(12, 2) default 0,
  down_payment          numeric(12, 2) default 0,
  notes                 text,
  case_id               uuid references public.cases(id) on delete set null,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  closed_at             timestamptz
);

create index if not exists deals_org_idx on public.deals(organization_id, status);
create index if not exists deals_party_idx on public.deals(party_id);
create index if not exists deals_fleet_idx on public.deals(fleet_vehicle_id);

comment on column public.deals.fleet_vehicle_id is
  'UUID from Command Center public.fleet — no FK (separate Supabase project).';

-- -----------------------------------------------------------------------------
-- DEAL PAYMENTS — cash-in log per deal (collections-lite foundation)
-- -----------------------------------------------------------------------------
create table if not exists public.deal_payments (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  amount      numeric(12, 2) not null,
  paid_at     timestamptz not null default now(),
  method      text not null default 'cash',
  reference   text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists deal_payments_deal_idx on public.deal_payments(deal_id, paid_at desc);

-- Updated_at triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists parties_touch on public.parties;
create trigger parties_touch before update on public.parties
  for each row execute function public.touch_updated_at();

drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.parties enable row level security;
alter table public.deals enable row level security;
alter table public.deal_payments enable row level security;

drop policy if exists parties_staff on public.parties;
create policy parties_staff on public.parties for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists deals_staff on public.deals;
create policy deals_staff on public.deals for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists deal_payments_staff on public.deal_payments;
create policy deal_payments_staff on public.deal_payments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Pilot: mark first TMMT org as rental; add dealer org via seed or dashboard
-- update public.organizations set vertical = 'dealer' where name ilike '%dealer%';
