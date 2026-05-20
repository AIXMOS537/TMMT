-- GHL marketing KPI auto-sync + partner vertical on organizations

alter table public.marketing_kpi_weeks
  add column if not exists ghl_synced_at timestamptz,
  add column if not exists ghl_auto jsonb not null default '{}'::jsonb;

comment on column public.marketing_kpi_weeks.ghl_auto is
  'Metrics last pulled from GHL (subscribers, calls, forms, etc.). Manual fields (followers, views) stay user-entered.';

alter table public.organizations
  add column if not exists partner_app_slug text;

comment on column public.organizations.partner_app_slug is
  'Wave app slug from partner catalog (e.g. tmmt_property, service_arbitrage). Drives white-label shell when set.';

do $$ begin
  alter type public.org_vertical add value if not exists 'property';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.org_vertical add value if not exists 'service_arbitrage';
exception when duplicate_object then null; end $$;

insert into public.marketplace_listings (
  vertical_slug, listing_type, title, description, financial_summary, featured, active
)
select 'tmmt_property', 'deal'::public.marketplace_listing_type,
  'STR arbitrage — 2BR suburban market',
  'Sample short-term rental deal model for TMMT Property partners.',
  'Est. $2,400/mo gross · 65% occupancy target', true, true
where not exists (select 1 from public.marketplace_listings where vertical_slug = 'tmmt_property');
