-- Vehicle hub: damages, media, portal-aware staff/admin RLS
-- Apply after 0007_client_rental_hub.sql (and 0004 for vehicles/bookings).

do $$ begin
  create type public.damage_severity as enum ('minor', 'moderate', 'major');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.damage_status as enum ('reported', 'in_review', 'repair_scheduled', 'resolved');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- VEHICLE DAMAGE REPORTS
-- -----------------------------------------------------------------------------
create table if not exists public.vehicle_damage_reports (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid references public.cases(id) on delete set null,
  booking_id        uuid references public.bookings(id) on delete set null,
  vehicle_id        uuid references public.vehicles(id) on delete set null,
  customer_email    text not null,
  title             text not null,
  description       text,
  severity          public.damage_severity not null default 'minor',
  status            public.damage_status not null default 'reported',
  visible_to_client boolean not null default true,
  reported_by       uuid references public.profiles(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists vehicle_damage_email_idx on public.vehicle_damage_reports(lower(customer_email));
create index if not exists vehicle_damage_case_idx on public.vehicle_damage_reports(case_id);

-- -----------------------------------------------------------------------------
-- VEHICLE MEDIA (photos / documents)
-- -----------------------------------------------------------------------------
create table if not exists public.vehicle_media (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid references public.cases(id) on delete set null,
  booking_id        uuid references public.bookings(id) on delete set null,
  vehicle_id        uuid references public.vehicles(id) on delete set null,
  customer_email    text not null,
  storage_path      text not null,
  file_name         text,
  caption           text,
  media_type        text not null default 'photo',
  visible_to_client boolean not null default true,
  uploaded_by       uuid references public.profiles(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists vehicle_media_email_idx on public.vehicle_media(lower(customer_email));
create index if not exists vehicle_media_case_idx on public.vehicle_media(case_id);

-- -----------------------------------------------------------------------------
-- Portal-aware staff / admin (ops RLS + profile updates)
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select
      role in ('admin', 'internal_team')
      or coalesce(portal_role::text, '') in ('team_member', 'manager', 'admin', 'super_admin')
    from public.profiles
    where id = auth.uid()
  ), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select
      role = 'admin'
      or coalesce(portal_role::text, '') in ('admin', 'super_admin')
    from public.profiles
    where id = auth.uid()
  ), false)
$$;

-- -----------------------------------------------------------------------------
-- RLS — damages & media
-- -----------------------------------------------------------------------------
alter table public.vehicle_damage_reports enable row level security;
alter table public.vehicle_media enable row level security;

drop policy if exists vehicle_damage_client_read on public.vehicle_damage_reports;
create policy vehicle_damage_client_read on public.vehicle_damage_reports for select
  using (
    visible_to_client = true
    and lower(customer_email) = lower(public.current_profile_email())
  );

drop policy if exists vehicle_damage_staff on public.vehicle_damage_reports;
create policy vehicle_damage_staff on public.vehicle_damage_reports for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists vehicle_media_client_read on public.vehicle_media;
create policy vehicle_media_client_read on public.vehicle_media for select
  using (
    visible_to_client = true
    and lower(customer_email) = lower(public.current_profile_email())
  );

drop policy if exists vehicle_media_staff on public.vehicle_media;
create policy vehicle_media_staff on public.vehicle_media for all
  using (public.is_staff()) with check (public.is_staff());

-- Client read ledger: respect visible_to_client (if column exists)
drop policy if exists rental_ledger_client_read on public.rental_ledger;
create policy rental_ledger_client_read on public.rental_ledger for select
  using (
    lower(customer_email) = lower(public.current_profile_email())
    and coalesce(visible_to_client, true) = true
  );

-- -----------------------------------------------------------------------------
-- Storage bucket for field photos
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-media',
  'vehicle-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists vehicle_media_storage_staff on storage.objects;
create policy vehicle_media_storage_staff on storage.objects for all
  using (bucket_id = 'vehicle-media' and public.is_staff())
  with check (bucket_id = 'vehicle-media' and public.is_staff());

drop policy if exists vehicle_media_storage_client_read on storage.objects;
create policy vehicle_media_storage_client_read on storage.objects for select
  using (
    bucket_id = 'vehicle-media'
    and exists (
      select 1 from public.vehicle_media m
      where m.storage_path = name
        and m.visible_to_client = true
        and lower(m.customer_email) = lower(public.current_profile_email())
    )
  );

-- Entitlement for vehicle hub
insert into public.entitlements (slug, name, category, portal) values
  ('vehicle_hub', 'My vehicle', 'rental', 'client')
on conflict (slug) do nothing;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, 'vehicle_hub'
from public.packages p
where p.slug in ('starter', 'growth', 'elite', 'custom')
on conflict do nothing;
