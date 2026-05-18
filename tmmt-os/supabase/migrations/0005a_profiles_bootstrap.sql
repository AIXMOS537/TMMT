-- Bootstrap profiles for Supabase projects that have auth.users but no TMMT profiles table yet.
-- Safe to run before 0005_portals_entitlements.sql

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum (
    'admin', 'internal_team', 'investor', 'vendor', 'customer'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique,
  full_name       text,
  phone           text,
  role            public.user_role not null default 'customer',
  organization_id uuid,
  airtable_id     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','internal_team') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.email),
  'customer'::public.user_role
from auth.users u
on conflict (id) do update set email = excluded.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_staff() or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());
