-- Client rental hub: financial ledger, pipeline reminders, expanded client RLS

do $$ begin
  create type public.ledger_entry_type as enum (
    'deposit', 'deposit_return', 'payment', 'deduction', 'expense', 'refund'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ledger_entry_status as enum (
    'pending', 'processing', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- RENTAL LEDGER — deposits, deductions, refunds, expenses (client-visible)
-- -----------------------------------------------------------------------------
create table if not exists public.rental_ledger (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references public.profiles(id) on delete set null,
  customer_email  text not null,
  booking_id      uuid references public.bookings(id) on delete set null,
  case_id         uuid references public.cases(id) on delete set null,
  entry_type      public.ledger_entry_type not null,
  status          public.ledger_entry_status not null default 'pending',
  title           text not null,
  description     text,
  amount_cents    integer not null default 0,
  currency        text not null default 'usd',
  due_at          timestamptz,
  completed_at    timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists rental_ledger_email_idx on public.rental_ledger(lower(customer_email));
create index if not exists rental_ledger_status_idx on public.rental_ledger(status);

-- -----------------------------------------------------------------------------
-- CLIENT ALERTS — reminders tied to GHL pipeline stages
-- -----------------------------------------------------------------------------
create table if not exists public.client_alerts (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references public.profiles(id) on delete set null,
  customer_email    text not null,
  ghl_contact_id    text,
  sync_record_id    uuid references public.crm_sync_records(id) on delete set null,
  alert_type        text not null,
  canonical_stage   text,
  title             text not null,
  message           text not null,
  priority          text not null default 'normal',
  due_at            timestamptz,
  acknowledged_at   timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists client_alerts_email_idx on public.client_alerts(lower(customer_email));
create index if not exists client_alerts_unread_idx on public.client_alerts(customer_email, acknowledged_at);

-- -----------------------------------------------------------------------------
-- HELPERS
-- -----------------------------------------------------------------------------
create or replace function public.current_profile_email()
returns text
language sql stable security definer set search_path = public as $$
  select email from public.profiles where id = auth.uid()
$$;

-- Client-safe pipeline row (verified sync only, own email)
create or replace view public.client_renter_status as
select
  r.sync_record_id,
  r.ghl_contact_id,
  r.ghl_pipeline_name,
  r.ghl_stage,
  r.canonical_stage,
  r.customer_name,
  r.customer_email,
  r.case_id,
  r.updated_at
from public.renter_pipeline_status r
where r.customer_email is not null
  and lower(r.customer_email) = lower(public.current_profile_email());

grant select on public.client_renter_status to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.rental_ledger enable row level security;
alter table public.client_alerts enable row level security;

drop policy if exists rental_ledger_client_read on public.rental_ledger;
create policy rental_ledger_client_read on public.rental_ledger for select
  using (
    lower(customer_email) = lower(public.current_profile_email())
  );

drop policy if exists rental_ledger_staff on public.rental_ledger;
create policy rental_ledger_staff on public.rental_ledger for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists client_alerts_client_read on public.client_alerts;
create policy client_alerts_client_read on public.client_alerts for select
  using (lower(customer_email) = lower(public.current_profile_email()));

drop policy if exists client_alerts_client_ack on public.client_alerts;
create policy client_alerts_client_ack on public.client_alerts for update
  using (lower(customer_email) = lower(public.current_profile_email()))
  with check (lower(customer_email) = lower(public.current_profile_email()));

drop policy if exists client_alerts_staff on public.client_alerts;
create policy client_alerts_staff on public.client_alerts for all
  using (public.is_staff()) with check (public.is_staff());

-- Bookings & payments by email (in addition to profile_id)
drop policy if exists bookings_email_read on public.bookings;
create policy bookings_email_read on public.bookings for select
  using (
    profile_id = auth.uid()
    or (
      customer_email is not null
      and lower(customer_email) = lower(public.current_profile_email())
    )
  );

drop policy if exists payments_client_read on public.payments;
create policy payments_client_read on public.payments for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id
        and b.customer_email is not null
        and lower(b.customer_email) = lower(public.current_profile_email())
    )
  );

-- -----------------------------------------------------------------------------
-- ENTITLEMENTS — rental hub + maintenance for all client packages
-- -----------------------------------------------------------------------------
insert into public.entitlements (slug, name, category, portal) values
  ('rental_hub', 'My rental', 'rental', 'client'),
  ('maintenance_requests', 'Maintenance requests', 'support', 'client')
on conflict (slug) do nothing;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug
from public.packages p
cross join (values ('rental_hub'), ('maintenance_requests'), ('billing_portal')) as e(slug)
where p.slug in ('starter', 'growth', 'elite')
on conflict do nothing;

-- Starter did not include billing_portal — add rental + maintenance only for starter
insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug
from public.packages p
cross join (values ('rental_hub'), ('maintenance_requests')) as e(slug)
where p.slug = 'starter'
on conflict do nothing;
