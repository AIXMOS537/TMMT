-- Agency: suspend clients, Stripe Connect, dealer onboarding progress

alter table public.organizations
  add column if not exists suspended_at timestamptz,
  add column if not exists onboarding_step text default 'not_started',
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists stripe_connect_account_id text,
  add column if not exists connect_charges_enabled boolean not null default false,
  add column if not exists agency_revenue_share_pct smallint not null default 80;

comment on column public.organizations.suspended_at is 'When set, client org users cannot access ops/dealer workspaces.';
comment on column public.organizations.onboarding_step is 'not_started | org | inventory | first_deal | complete';
comment on column public.organizations.stripe_connect_account_id is 'Stripe Connect account for agency payout (acct_).';
comment on column public.organizations.agency_revenue_share_pct is 'Percent of subscription net to connected agency (platform keeps remainder).';
