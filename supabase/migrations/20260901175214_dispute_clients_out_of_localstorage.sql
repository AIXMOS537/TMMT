-- Real client records for the credit dispute desk.
--
-- Applied to uapxakmlwnpfsftfeezx as 20260901175214. The version and name here
-- match what production recorded, so scripts/migrations-pull.mjs will not
-- report this one as missing.
--
-- Until now this feature kept its clients in the browser: localStorage under
-- "aix-dispute-clients". That payload carries legal name, email, phone, date of
-- birth, social-security last four, address and tri-bureau scores — so the most
-- sensitive data in the business lived one cleared cache from gone, on whatever
-- machine happened to import it, backed up by nothing and reachable by no one
-- else.
--
-- Deliberately NOT the dispute_engine tables (credit_profiles, negative_items,
-- dispute_rounds). Those were designed for this and would be the better home,
-- but 20260707120000_dispute_engine.sql has never been applied here and
-- adopting it now would mean reconciling a nine-table schema the app has never
-- written to. This stores what the app actually has, in the shape it already
-- uses, and can be folded into that schema later without another data rescue.

create table if not exists public.dispute_clients (
  id           text primary key,
  client_name  text,
  email        text,
  source       text not null,
  external_id  text,
  payload      jsonb not null,
  imported_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists dispute_clients_email_idx on public.dispute_clients (lower(email));
create index if not exists dispute_clients_updated_idx on public.dispute_clients (updated_at desc);

alter table public.dispute_clients enable row level security;

-- The desk lives at /command, which is owner-only, and the payload is the most
-- sensitive thing in the database. Platform admins only — not is_staff().
drop policy if exists dispute_clients_admin_only on public.dispute_clients;
create policy dispute_clients_admin_only on public.dispute_clients
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

revoke all on public.dispute_clients from anon;

create or replace function public.dispute_clients_touch_updated_at()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dispute_clients_set_updated_at on public.dispute_clients;
create trigger dispute_clients_set_updated_at
  before update on public.dispute_clients
  for each row execute function public.dispute_clients_touch_updated_at();
