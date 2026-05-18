-- TMMT OS: Client rental hub + unified financial ledger
-- Safe to run in Supabase SQL Editor (idempotent where possible).
-- Combines migrations 0007_client_rental_hub.sql and 0008_unified_ledger_sync.sql.

-- =============================================================================
-- PREREQUISITES — hybrid TMMT OS DBs (portal without full 0001/0004)
-- =============================================================================

create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  ref_code        text unique not null default ('B-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  profile_id      uuid references public.profiles(id) on delete set null,
  case_id         uuid references public.cases(id) on delete set null,
  customer_name   text not null default 'Guest',
  customer_email  text,
  customer_phone  text,
  status          text not null default 'inquiry',
  starts_at       timestamptz,
  ends_at         timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_profile_idx on public.bookings(profile_id);
alter table public.bookings enable row level security;

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.bookings(id) on delete set null,
  case_id       uuid references public.cases(id) on delete set null,
  profile_id    uuid references public.profiles(id) on delete set null,
  amount_cents  integer not null,
  currency      text not null default 'usd',
  status        text not null default 'pending',
  provider      text,
  external_id   text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments(booking_id);
create index if not exists payments_status_idx on public.payments(status);
alter table public.payments enable row level security;

-- =============================================================================
-- 0007 — rental_ledger, client_alerts, client RLS, entitlements
-- =============================================================================

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

create or replace function public.current_profile_email()
returns text
language sql stable security definer set search_path = public as $$
  select email from public.profiles where id = auth.uid()
$$;

drop view if exists public.client_renter_status;
create view public.client_renter_status as
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

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug
from public.packages p
cross join (values ('rental_hub'), ('maintenance_requests')) as e(slug)
where p.slug = 'starter'
on conflict do nothing;

-- =============================================================================
-- 0008 — unified ledger sync (source, visibility, investor/vendor RLS, realtime)
-- =============================================================================

alter table public.rental_ledger
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists source text not null default 'team',
  add column if not exists organization_id uuid,
  add column if not exists customer_name text,
  add column if not exists visible_to_client boolean not null default true;

create index if not exists rental_ledger_created_idx on public.rental_ledger(created_at desc);
create index if not exists rental_ledger_org_idx on public.rental_ledger(organization_id);

comment on column public.rental_ledger.source is 'team | investor | vendor | system';
comment on column public.rental_ledger.visible_to_client is 'When false, internal/partner only';

-- Clients: only rows marked visible
drop policy if exists rental_ledger_client_read on public.rental_ledger;
create policy rental_ledger_client_read on public.rental_ledger for select
  using (
    visible_to_client = true
    and lower(customer_email) = lower(public.current_profile_email())
  );

drop policy if exists rental_ledger_investor_read on public.rental_ledger;
create policy rental_ledger_investor_read on public.rental_ledger for select
  using (public.current_role() = 'investor' or public.is_admin());

drop policy if exists rental_ledger_investor_insert on public.rental_ledger;
create policy rental_ledger_investor_insert on public.rental_ledger for insert
  with check (public.current_role() in ('investor', 'admin'));

drop policy if exists rental_ledger_investor_update on public.rental_ledger;
create policy rental_ledger_investor_update on public.rental_ledger for update
  using (public.current_role() in ('investor', 'admin'))
  with check (public.current_role() in ('investor', 'admin'));

do $$
begin
  if to_regclass('public.vendors') is not null and to_regclass('public.vendor_jobs') is not null then
    execute $pol$
      drop policy if exists rental_ledger_vendor_read on public.rental_ledger;
      create policy rental_ledger_vendor_read on public.rental_ledger for select
        using (
          public.current_role() = 'vendor'
          and (
            case_id in (
              select vj.case_id from public.vendor_jobs vj
              join public.vendors v on v.id = vj.vendor_id
              where v.profile_id = auth.uid() and vj.case_id is not null
            )
            or created_by = auth.uid()
          )
        );
      drop policy if exists rental_ledger_vendor_insert on public.rental_ledger;
      create policy rental_ledger_vendor_insert on public.rental_ledger for insert
        with check (
          public.current_role() = 'vendor'
          and (
            case_id is null
            or case_id in (
              select vj.case_id from public.vendor_jobs vj
              join public.vendors v on v.id = vj.vendor_id
              where v.profile_id = auth.uid() and vj.case_id is not null
            )
          )
        );
    $pol$;
  end if;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.rental_ledger;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
