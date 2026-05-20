-- Retail vs passive/managed partner split rules (see 0027 for base schema)

alter table public.organizations
  add column if not exists partner_has_own_system boolean not null default false;

alter table public.client_journey
  add column if not exists partner_has_own_system boolean not null default false;

comment on column public.organizations.partner_client_segment is
  'retail = relationship partner (90/10–70/30, requires own system); business_owner = passive/managed (60/40–50/50, always eligible).';

comment on column public.organizations.partner_has_own_system is
  'Retail segment: partner operates their own system and receives TMMT management.';

comment on column public.organizations.partner_has_startup_capital is
  'Legacy; no longer gates passive tiers. Use partner_has_own_system for retail eligibility.';

comment on column public.organizations.partner_qualified_vehicle_count is
  'Optional retail fleet size context; does not gate passive/managed tiers.';

-- Passive / managed partners are always eligible for 60/40 and 50/50 tiers
create or replace function public.partner_business_owner_eligible(
  p_has_capital boolean,
  p_vehicle_count integer
)
returns boolean
language sql immutable as $$
  select true;
$$;

create or replace function public.partner_retail_eligible(p_has_own_system boolean)
returns boolean
language sql immutable as $$
  select coalesce(p_has_own_system, false);
$$;

drop function if exists public.partner_tier_allowed_for_segment(
  public.partner_client_segment,
  public.partner_revenue_split_tier,
  boolean,
  integer
);

create or replace function public.partner_tier_allowed_for_segment(
  p_segment public.partner_client_segment,
  p_tier public.partner_revenue_split_tier,
  p_has_own_system boolean,
  p_has_capital boolean default false,
  p_vehicle_count integer default 0
)
returns boolean
language sql stable as $$
  select case
    when p_segment is null or p_tier is null then false
    when p_segment = 'retail' then
      p_tier in ('90_10', '80_20', '70_30')
      and public.partner_retail_eligible(p_has_own_system)
    when p_segment = 'business_owner' then
      p_tier in ('60_40', '50_50')
      and public.partner_business_owner_eligible(p_has_capital, p_vehicle_count)
    else false
  end;
$$;
