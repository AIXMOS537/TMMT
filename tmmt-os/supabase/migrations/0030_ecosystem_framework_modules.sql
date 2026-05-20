-- Marketplace listings, marketing KPI weeks, COO briefings, partner vertical seeds
-- Framework PDFs adapted May 2026

do $$ begin
  create type public.marketplace_listing_type as enum ('deal', 'vendor', 'opportunity');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.coo_briefing_kind as enum ('daily', 'weekly');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- MARKETPLACE (Module 3 — deals, vendors, opportunities)
-- -----------------------------------------------------------------------------
create table if not exists public.marketplace_listings (
  id                uuid primary key default gen_random_uuid(),
  vertical_slug     text not null default 'tmmt_rentals',
  listing_type      public.marketplace_listing_type not null default 'deal',
  title             text not null,
  description       text,
  financial_summary text,
  external_url      text,
  featured          boolean not null default false,
  active            boolean not null default true,
  metadata          jsonb not null default '{}'::jsonb,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists marketplace_listings_active_idx
  on public.marketplace_listings(active, featured desc, created_at desc);

-- -----------------------------------------------------------------------------
-- MARKETING KPI (weekly rollup — Chief of Marketing brief)
-- -----------------------------------------------------------------------------
create table if not exists public.marketing_kpi_weeks (
  week_start        date primary key,
  followers         integer not null default 0,
  reel_views        integer not null default 0,
  story_views       integer not null default 0,
  dm_started        integer not null default 0,
  calls_booked      integer not null default 0,
  new_subscribers   integer not null default 0,
  email_list_growth integer not null default 0,
  notes             text,
  submitted_by      uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- COO BRIEFINGS (9AM daily + weekly ops)
-- -----------------------------------------------------------------------------
create table if not exists public.coo_briefings (
  id                uuid primary key default gen_random_uuid(),
  briefing_date     date not null,
  kind              public.coo_briefing_kind not null,
  pipeline_health   text,
  escalations       text,
  director_sync     text,
  blockers          text,
  weekly_summary    text,
  loom_url          text,
  submitted_by      uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (briefing_date, kind)
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.marketplace_listings enable row level security;
alter table public.marketing_kpi_weeks enable row level security;
alter table public.coo_briefings enable row level security;

drop policy if exists marketplace_listings_client_read on public.marketplace_listings;
create policy marketplace_listings_client_read on public.marketplace_listings
  for select using (active = true);

drop policy if exists marketplace_listings_staff on public.marketplace_listings;
create policy marketplace_listings_staff on public.marketplace_listings
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists marketing_kpi_staff on public.marketing_kpi_weeks;
create policy marketing_kpi_staff on public.marketing_kpi_weeks
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists coo_briefings_staff on public.coo_briefings;
create policy coo_briefings_staff on public.coo_briefings
  for all using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- ENTITLEMENTS
-- -----------------------------------------------------------------------------
insert into public.entitlements (slug, name, category, description, portal) values
  ('marketplace_hub', 'Marketplace', 'app', 'Deal flow, vendors, and opportunities', 'client')
on conflict (slug) do nothing;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, 'marketplace_hub' from public.packages p
where p.slug in ('growth', 'elite', 'custom')
;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, 'marketplace_hub' from public.packages p
where p.slug = 'starter'
;

-- Sample marketplace rows (rental vertical)
insert into public.marketplace_listings (
  vertical_slug, listing_type, title, description, financial_summary, featured, active
) values
  (
    'tmmt_rentals',
    'deal',
    'Economy fleet — 7-day arbitrage model',
    'Sample deal flow listing. Replace with vetted opportunities from your network.',
    'Est. $420/wk gross · $180/wk net after expenses (illustrative)',
    true,
    true
  ),
  (
    'tmmt_rentals',
    'vendor',
    'Preferred mobile detail partner',
    'Vendor directory entry for fleet prep between rentals.',
    'From $85/vehicle · TMMT-negotiated rate',
    false,
    true
  ),
  (
    'tmmt_rentals',
    'opportunity',
    'Off-platform direct booking funnel',
    'Opportunity to add a second income stream alongside Turo.',
    'Requires GHL pipeline + TMMT OS case tracking',
    false,
    true
  )
;
