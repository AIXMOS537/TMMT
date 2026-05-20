-- Month 2: per-org billing + agency hierarchy

alter table public.organizations
  add column if not exists parent_agency_id uuid references public.organizations(id) on delete set null,
  add column if not exists plan_tier text not null default 'starter',
  add column if not exists billing_status text not null default 'trialing',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists organizations_agency_idx on public.organizations(parent_agency_id);
create index if not exists organizations_stripe_customer_idx on public.organizations(stripe_customer_id);

comment on column public.organizations.parent_agency_id is 'Agency (All In One) → client dealer/rental org.';
comment on column public.organizations.plan_tier is 'starter | growth | pro';
comment on column public.organizations.billing_status is 'trialing | active | past_due | canceled';

-- Optional scheduled payment on deals (collections-lite)
alter table public.deals
  add column if not exists next_payment_due date,
  add column if not exists payment_schedule_cents integer;
