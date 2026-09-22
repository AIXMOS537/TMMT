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
-- 2. is_credit_operator(org) — SECURITY DEFINER, reads org_roles directly, so it is
--    not caught by the org_roles tenant_admin_write policy recursion (42P17) found
--    on prod 2026-09-21. Deliberately NOT OR'ed with is_staff(): staff are not
--    credit operators by default (memory: is_staff() is broad on ~186 policies).
-- 3. dispute_clients policy: platform admin, or a credit operator of the row's org.
-- 4. credit_evidence: document metadata per client / item / assertion / round, with
--    the same org rule, org_id pinned to the parent client's, no public URLs, no
--    DELETE for API roles, anon revoked.
-- 5. A private storage bucket for the files (applied only where storage exists).
--
-- ROLLBACK
--   drop table if exists public.credit_evidence;
--   drop policy if exists dispute_clients_org_credit_operator on public.dispute_clients;
--   drop function if exists public.is_credit_operator(uuid);
--   alter table public.dispute_clients drop column if exists org_id;
--   (the original dispute_clients_admin_only policy is left in place throughout)

alter table public.dispute_clients add column if not exists org_id uuid references public.organizations(id);

create or replace function public.is_credit_operator(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p_org is not null and exists (
    select 1 from public.org_roles r
    where r.org_id = p_org
      and r.user_id = auth.uid()
      and r.role in ('tenant_admin', 'credit_operator')
  )
$$;
revoke all on function public.is_credit_operator(uuid) from public, anon;
grant execute on function public.is_credit_operator(uuid) to authenticated;

-- Additive: the existing admin-only policy stays; this lets an org's credit
-- operators reach that org's rows (and only rows that HAVE an org).
drop policy if exists dispute_clients_org_credit_operator on public.dispute_clients;
create policy dispute_clients_org_credit_operator on public.dispute_clients
  for all to authenticated
  using (org_id is not null and public.is_credit_operator(org_id))
  with check (org_id is not null and public.is_credit_operator(org_id));

create table if not exists public.credit_evidence (
  id text primary key,
  dispute_client_id text not null references public.dispute_clients(id) on delete cascade,
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
  uploaded_by uuid not null default auth.uid(),
  uploaded_at timestamptz not null default now()
);

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
grant insert (id, dispute_client_id, negative_item_id, assertion_id, round_id, kind, description, storage_path, sha256, source)
  on public.credit_evidence to authenticated;
grant update (description, kind, negative_item_id, assertion_id, round_id) on public.credit_evidence to authenticated;

-- Private bucket for the documents themselves. Run only where the storage schema
-- exists (production); the rehearsal skips it.
-- insert into storage.buckets (id, name, public, file_size_limit)
--   values ('credit-evidence', 'credit-evidence', false, 12582912)
--   on conflict (id) do update set public = false;
-- Object policies: path prefix '<org_id>/<dispute_client_id>/' and the same
-- is_platform_admin() / is_credit_operator(org) rule; signed URLs only, short TTL.
