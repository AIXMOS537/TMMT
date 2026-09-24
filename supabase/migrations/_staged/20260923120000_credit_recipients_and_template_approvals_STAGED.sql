-- STAGED — NOT APPLIED. Credit C3: recipient registry + attorney-gate approval records.
--
-- Owner-gated production change (prod write baton). Apply AFTER
-- 20260922120000_credit_case_foundation_STAGED.sql. Rehearsed by
-- scripts/tests/sql/credit-c3-registry.rehearsal.mjs.
--
-- Neither table opens anything. With both empty (as they start), the app can
-- address no letter (no verified recipient) and render no template (no approval),
-- even if the CROA gate flag were flipped. Fail closed.
--
-- ROLLBACK
--   drop table if exists public.credit_template_approvals;
--   drop table if exists public.credit_recipients;
--   drop function if exists public.credit_recipients_guard();
--   drop function if exists public.credit_template_approvals_guard();

-- ---------------------------------------------------------------- recipients
create table if not exists public.credit_recipients (
  recipient_id text not null check (recipient_id ~ '^(CRA|FURNISHER|COLLECTOR|OTHER_APPROVED):[a-z0-9-]{1,80}$'),
  version integer not null check (version >= 1),
  record jsonb not null,
  created_at timestamptz not null default now(),
  primary key (recipient_id, version),
  check (record->>'recipientId' = recipient_id and (record->>'version')::int = version)
);

-- A version's identity and address are fixed once written. Only its verification
-- (status/by/at/method) and its effectiveTo (closing it when superseded) may change.
create or replace function public.credit_recipients_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' then
    if (new.record - 'verification' - 'effectiveTo') is distinct from (old.record - 'verification' - 'effectiveTo') then
      raise exception 'credit_recipients: a version''s name/address/source cannot change; add a new version' using errcode = '42501';
    end if;
    if new.record->'verification'->>'status' = 'verified'
       and coalesce(new.record->'verification'->>'by', '') ~* '^(ai|agent|aixmos|system)[:_-]' then
      raise exception 'credit_recipients: only a person can verify a recipient' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.credit_recipients_guard() from public, anon, authenticated;
drop trigger if exists credit_recipients_guard on public.credit_recipients;
create trigger credit_recipients_guard before update on public.credit_recipients
  for each row execute function public.credit_recipients_guard();

alter table public.credit_recipients enable row level security;
drop policy if exists credit_recipients_admin_read on public.credit_recipients;
create policy credit_recipients_admin_read on public.credit_recipients for select to authenticated using (public.is_platform_admin());
drop policy if exists credit_recipients_admin_insert on public.credit_recipients;
create policy credit_recipients_admin_insert on public.credit_recipients for insert to authenticated with check (public.is_platform_admin());
drop policy if exists credit_recipients_admin_update on public.credit_recipients;
create policy credit_recipients_admin_update on public.credit_recipients for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.credit_recipients from anon, authenticated;
grant select, insert on public.credit_recipients to authenticated;
grant update (record) on public.credit_recipients to authenticated;

-- ---------------------------------------------------------------- template approvals
create table if not exists public.credit_template_approvals (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,80}$'),
  template_id text not null check (template_id ~ '^letter:[a-z0-9_]{3,40}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  record jsonb not null,
  created_at timestamptz not null default now(),
  check (record->>'id' = id and record->>'templateId' = template_id and record->>'contentHash' = content_hash)
);
create index if not exists credit_template_approvals_template_idx on public.credit_template_approvals (template_id, content_hash);

-- Append-only. The ONLY permitted change is active -> revoked (with who/when).
create or replace function public.credit_template_approvals_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.record->>'approver', '') ~* '^(ai|agent|aixmos|system)[:_-]' then
      raise exception 'credit_template_approvals: only a person can approve a template' using errcode = '42501';
    end if;
    if new.record->>'status' <> 'active' then
      raise exception 'credit_template_approvals: a new approval starts active' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.record->>'status' <> 'active' or new.record->>'status' <> 'revoked'
     or (new.record - 'status' - 'revokedBy' - 'revokedAt') is distinct from (old.record - 'status' - 'revokedBy' - 'revokedAt') then
    raise exception 'credit_template_approvals: approvals are append-only; the only change is revocation' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.credit_template_approvals_guard() from public, anon, authenticated;
drop trigger if exists credit_template_approvals_guard on public.credit_template_approvals;
create trigger credit_template_approvals_guard before insert or update on public.credit_template_approvals
  for each row execute function public.credit_template_approvals_guard();

alter table public.credit_template_approvals enable row level security;
drop policy if exists credit_template_approvals_admin_read on public.credit_template_approvals;
create policy credit_template_approvals_admin_read on public.credit_template_approvals for select to authenticated using (public.is_platform_admin());
drop policy if exists credit_template_approvals_admin_insert on public.credit_template_approvals;
create policy credit_template_approvals_admin_insert on public.credit_template_approvals for insert to authenticated with check (public.is_platform_admin());
drop policy if exists credit_template_approvals_admin_revoke on public.credit_template_approvals;
create policy credit_template_approvals_admin_revoke on public.credit_template_approvals for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.credit_template_approvals from anon, authenticated;
grant select, insert on public.credit_template_approvals to authenticated;
grant update (record) on public.credit_template_approvals to authenticated;
