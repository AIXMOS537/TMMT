-- Partner / investor vs agency revenue split tiers (retail 90-70%, business 50-60%)

do $$ begin
  create type public.partner_client_segment as enum ('retail', 'business_owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_revenue_split_tier as enum (
    '90_10', '80_20', '70_30', '60_40', '50_50'
  );
exception when duplicate_object then null; end $$;

alter table public.organizations
  add column if not exists partner_client_segment public.partner_client_segment,
  add column if not exists partner_revenue_split_tier public.partner_revenue_split_tier,
  add column if not exists partner_has_startup_capital boolean not null default false,
  add column if not exists partner_qualified_vehicle_count integer not null default 0,
  add column if not exists partner_split_auto_track boolean not null default true;

comment on column public.organizations.partner_client_segment is
  'retail = 90/10–70/30 tiers; business_owner = 60/40–50/50 (requires capital or 10+ TMMT-qualified vehicles).';
comment on column public.organizations.partner_revenue_split_tier is
  'Partner/agency split as partner_pct/agency_pct (e.g. 60_40 = partner 60%, TMMT 40%).';
comment on column public.organizations.partner_qualified_vehicle_count is
  'Fleet units meeting TMMT requirements; staff-synced or counted from dealer inventory.';
comment on column public.organizations.partner_split_auto_track is
  'When true, revenue split rows use this org tier automatically.';

alter table public.client_journey
  add column if not exists partner_client_segment public.partner_client_segment,
  add column if not exists partner_revenue_split_tier public.partner_revenue_split_tier,
  add column if not exists partner_has_startup_capital boolean not null default false,
  add column if not exists partner_qualified_vehicle_count integer not null default 0;

alter table public.revenue_splits
  alter column operator_id drop not null;

alter table public.revenue_splits
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists partner_cents integer,
  add column if not exists agency_cents integer,
  add column if not exists partner_pct smallint,
  add column if not exists agency_pct smallint,
  add column if not exists split_tier public.partner_revenue_split_tier,
  add column if not exists split_segment public.partner_client_segment;

create index if not exists revenue_splits_org_idx on public.revenue_splits(organization_id);

-- Resolve partner % from tier (partner first in 60/40 notation)
create or replace function public.partner_pct_from_tier(p_tier public.partner_revenue_split_tier)
returns smallint
language sql immutable as $$
  select case p_tier
    when '90_10' then 90
    when '80_20' then 80
    when '70_30' then 70
    when '60_40' then 60
    when '50_50' then 50
    else 50
  end;
$$;

create or replace function public.agency_pct_from_tier(p_tier public.partner_revenue_split_tier)
returns smallint
language sql immutable as $$
  select (100 - public.partner_pct_from_tier(p_tier))::smallint;
$$;

-- Business-owner tiers require capital or min 10 qualified vehicles
create or replace function public.partner_business_owner_eligible(
  p_has_capital boolean,
  p_vehicle_count integer
)
returns boolean
language sql immutable as $$
  select coalesce(p_has_capital, false) or coalesce(p_vehicle_count, 0) >= 10;
$$;

create or replace function public.partner_tier_allowed_for_segment(
  p_segment public.partner_client_segment,
  p_tier public.partner_revenue_split_tier,
  p_has_capital boolean,
  p_vehicle_count integer
)
returns boolean
language sql stable as $$
  select case
    when p_segment is null or p_tier is null then false
    when p_segment = 'retail' then p_tier in ('90_10', '80_20', '70_30')
    when p_segment = 'business_owner' then
      p_tier in ('60_40', '50_50')
      and public.partner_business_owner_eligible(p_has_capital, p_vehicle_count)
    else false
  end;
$$;
