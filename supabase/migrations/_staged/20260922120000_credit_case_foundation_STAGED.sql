-- STAGED — NOT APPLIED. Credit Center case foundation (Phase C1, design only).
--
-- Owner-gated production change. Do not apply without owner approval and the prod
-- write baton (docs/ops/PROD-WRITE-BATON.md). Rehearsed by
-- scripts/tests/sql/credit-isolation.rehearsal.mjs.
--
-- WHY
-- dispute_clients (0 rows on prod, 2026-09-21) is one JSON document per client with
-- NO org_id: the only access rule is is_platform_admin(). That is safe while the
-- only user is the owner, but it cannot express "an operator for Org A sees Org A's
-- credit cases and nothing else", and there is no table for supporting documents.
--
-- WHAT THIS DOES
-- 1. dispute_clients.org_id (nullable; existing rows stay platform-admin only).
-- 2. credit_operator_grants + is_credit_operator(org) — SECURITY DEFINER.
--    C3 correction (rehearsed against the production catalog shape): the C1 draft
--    read org_roles for role 'credit_operator', but prod's org_roles_role_check only
--    allows tenant_admin / dispatcher / responder / viewer, so that role could never
--    be granted — and every tenant_admin would silently have become a credit
--    operator, able (once the org_roles recursion is repaired) to hand credit files
--    to anyone in their org. Credit access is now its own grant, written ONLY by a
--    platform admin, revocable, never deleted. Not OR'ed with is_staff() or any org
--    role: staff and tenant admins are not credit operators by default.
-- 3. dispute_clients policies: platform admin (existing, unchanged), or a credit
--    operator of the row's org — select / insert / update only. No DELETE.
-- 4. credit_evidence: document metadata per client / item / assertion / round, with
--    the same org rule, org_id pinned to the parent client's, no public URLs, no
--    DELETE for API roles, anon revoked.
-- 5. A private storage bucket for the files (applied only where storage exists).
--
-- ROLLBACK
--   drop table if exists public.credit_evidence;
--   drop function if exists public.credit_evidence_pin_org();
--   drop policy if exists dispute_clients_org_credit_operator on public.dispute_clients;
--   drop policy if exists dispute_clients_org_credit_operator_read on public.dispute_clients;
--   drop policy if exists dispute_clients_org_credit_operator_insert on public.dispute_clients;
--   drop policy if exists dispute_clients_org_credit_operator_update on public.dispute_clients;
--   drop function if exists public.is_credit_operator(uuid);
--   drop table if exists public.credit_operator_grants;
--   drop function if exists public.credit_operator_grants_guard();
--   drop index if exists public.dispute_clients_customer_user_id_key;
--   alter table public.dispute_clients drop column if exists customer_user_id;
--   alter table public.dispute_clients drop column if exists org_id;
--   (the original dispute_clients_admin_only policy is left in place throughout)

alter table public.dispute_clients add column if not exists org_id uuid references public.organizations(id);
create index if not exists dispute_clients_org_id_idx on public.dispute_clients (org_id) where org_id is not null;

-- C2: the customer's own login, set by an owner (mirrors payload.customerUserId).
-- One case per customer. Deliberately NO customer RLS policy on this table: the row
-- also holds operator notes, letters and identifiers, so customers only ever get the
-- minimised view through the server actions (data minimisation, not an oversight).
alter table public.dispute_clients add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists dispute_clients_customer_user_id_key on public.dispute_clients (customer_user_id) where customer_user_id is not null;

-- Who may work an org's credit cases. Platform admin writes; nobody deletes; a
-- grant ends by revocation (kept for the audit trail).
create table if not exists public.credit_operator_grants (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null default auth.uid(),
  granted_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 500),
  revoked_at timestamptz,
  revoked_by uuid,
  primary key (org_id, user_id)
);

-- The only change after insert: revoke (once). Grantor, org and user are fixed.
create or replace function public.credit_operator_grants_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if old.revoked_at is not null
     or new.revoked_at is null
     or (new.org_id, new.user_id, new.granted_by, new.granted_at) is distinct from (old.org_id, old.user_id, old.granted_by, old.granted_at) then
    raise exception 'credit_operator_grants: the only change is a one-time revocation' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.credit_operator_grants_guard() from public, anon, authenticated;
drop trigger if exists credit_operator_grants_guard on public.credit_operator_grants;
create trigger credit_operator_grants_guard before update on public.credit_operator_grants
  for each row execute function public.credit_operator_grants_guard();

alter table public.credit_operator_grants enable row level security;
drop policy if exists credit_operator_grants_admin_read on public.credit_operator_grants;
create policy credit_operator_grants_admin_read on public.credit_operator_grants for select to authenticated using (public.is_platform_admin());
drop policy if exists credit_operator_grants_admin_insert on public.credit_operator_grants;
create policy credit_operator_grants_admin_insert on public.credit_operator_grants for insert to authenticated
  with check (public.is_platform_admin() and granted_by = auth.uid() and revoked_at is null);
drop policy if exists credit_operator_grants_admin_revoke on public.credit_operator_grants;
create policy credit_operator_grants_admin_revoke on public.credit_operator_grants for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin() and revoked_by = auth.uid());
revoke all on public.credit_operator_grants from anon, authenticated;
grant select on public.credit_operator_grants to authenticated;
grant insert (org_id, user_id, note) on public.credit_operator_grants to authenticated;
grant update (revoked_at, revoked_by) on public.credit_operator_grants to authenticated;

create or replace function public.is_credit_operator(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p_org is not null and auth.uid() is not null and exists (
    select 1 from public.credit_operator_grants g
    where g.org_id = p_org
      and g.user_id = auth.uid()
      and g.revoked_at is null
  )
$$;
revoke all on function public.is_credit_operator(uuid) from public, anon;
grant execute on function public.is_credit_operator(uuid) to authenticated;

-- Additive: the existing admin-only policy stays; these let an org's credit
-- operators reach that org's rows (and only rows that HAVE an org). No DELETE:
-- removing a case is a platform-admin act.
drop policy if exists dispute_clients_org_credit_operator on public.dispute_clients;
drop policy if exists dispute_clients_org_credit_operator_read on public.dispute_clients;
create policy dispute_clients_org_credit_operator_read on public.dispute_clients
  for select to authenticated
  using (org_id is not null and public.is_credit_operator(org_id));
drop policy if exists dispute_clients_org_credit_operator_insert on public.dispute_clients;
create policy dispute_clients_org_credit_operator_insert on public.dispute_clients
  for insert to authenticated
  with check (org_id is not null and public.is_credit_operator(org_id));
drop policy if exists dispute_clients_org_credit_operator_update on public.dispute_clients;
create policy dispute_clients_org_credit_operator_update on public.dispute_clients
  for update to authenticated
  using (org_id is not null and public.is_credit_operator(org_id))
  with check (org_id is not null and public.is_credit_operator(org_id));

create table if not exists public.credit_evidence (
  id text primary key,
  -- RESTRICT, not CASCADE: deleting a case must not silently drop the record of its
  -- documents (the storage objects would be orphaned). Evidence is removed on purpose.
  dispute_client_id text not null references public.dispute_clients(id) on delete restrict,
  org_id uuid references public.organizations(id),
  negative_item_id text,
  assertion_id text,
  round_id text,
  kind text not null check (kind in (
    'identity_theft_report','payment_record','account_statement','settlement_letter',
    'bankruptcy_discharge','correspondence','credit_report_copy','id_document','other')),
  description text not null check (length(description) between 3 and 500),
  -- A private bucket object path. Never a URL.
  storage_path text check (storage_path is null or storage_path !~* '^[a-z]+://'),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  source text not null check (source in ('customer','operator')),
  -- C2 file metadata: the display name is sanitised text only; the type is what the
  -- bytes were sniffed as; size is capped like the bucket.
  file_name text check (file_name is null or length(file_name) <= 80),
  mime text check (mime is null or mime in ('application/pdf','image/png','image/jpeg','image/webp')),
  size_bytes integer check (size_bytes is null or (size_bytes > 0 and size_bytes <= 10485760)),
  review_state text not null default 'pending_review' check (review_state in ('pending_review','accepted','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  uploaded_by uuid not null default auth.uid(),
  uploaded_at timestamptz not null default now()
);
create index if not exists credit_evidence_client_idx on public.credit_evidence (dispute_client_id);
create index if not exists credit_evidence_org_idx on public.credit_evidence (org_id) where org_id is not null;

-- org_id must match the parent client's; a row cannot be filed under another org.
create or replace function public.credit_evidence_pin_org()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  select c.org_id into new.org_id from public.dispute_clients c where c.id = new.dispute_client_id;
  return new;
end;
$$;
revoke all on function public.credit_evidence_pin_org() from public, anon, authenticated;
drop trigger if exists credit_evidence_pin_org on public.credit_evidence;
create trigger credit_evidence_pin_org before insert or update on public.credit_evidence
  for each row execute function public.credit_evidence_pin_org();

alter table public.credit_evidence enable row level security;

drop policy if exists credit_evidence_admin on public.credit_evidence;
drop policy if exists credit_evidence_org_operator on public.credit_evidence;
create policy credit_evidence_admin on public.credit_evidence
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy credit_evidence_org_operator on public.credit_evidence
  for all to authenticated
  using (org_id is not null and public.is_credit_operator(org_id))
  with check (org_id is not null and public.is_credit_operator(org_id));

revoke all on public.credit_evidence from anon, authenticated;
grant select on public.credit_evidence to authenticated;
-- org_id, uploaded_by and uploaded_at are set by the server (trigger / defaults), never by the caller.
grant insert (id, dispute_client_id, negative_item_id, assertion_id, round_id, kind, description, storage_path, sha256, source, file_name, mime, size_bytes)
  on public.credit_evidence to authenticated;
-- The file itself (path, hash, type, size) is fixed once stored; only labels and the review may change.
grant update (description, kind, negative_item_id, assertion_id, round_id, review_state, reviewed_by, reviewed_at) on public.credit_evidence to authenticated;

-- Private bucket for the documents themselves. Run only where the storage schema
-- exists (production); the rehearsal skips it.
-- insert into storage.buckets (id, name, public, file_size_limit)
--   values ('credit-evidence', 'credit-evidence', false, 12582912)
--   on conflict (id) do update set public = false;
-- Object policies: path prefix '<org_id>/<dispute_client_id>/' and the same
-- is_platform_admin() / is_credit_operator(org) rule; signed URLs only, short TTL.
