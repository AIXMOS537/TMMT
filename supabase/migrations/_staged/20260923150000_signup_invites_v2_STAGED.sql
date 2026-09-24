-- STAGED — NOT APPLIED. signup_invites v2: lifecycle, binding, server-only claim (C3-001/002).
--
-- Owner-gated production change (prod write baton). Rehearsed by
-- scripts/tests/sql/signup-invites-v2.rehearsal.mjs (with mutations).
--
-- TODAY (prod, 2026-09-21): signup_invites(id, code_hash unique, label, email,
-- expires_at, used_at, used_by, created_at, created_by); RLS on, 0 policies, no grants
-- for anon/authenticated; 0 rows. Revoking = deleting the row (scripts/invite.mjs).
-- The claim is an app-side conditional UPDATE.
--
-- WHAT THIS ADDS
--   status       pending | accepted | revoked  (EXPIRED is computed from expires_at,
--                never stored early; see inviteState() in src/lib/signup-invite.ts)
--   revoked_at / revoked_by — revocation is a status change, the row is kept
--   relationship_kind / relationship_ref — ONE optional binding (today only
--                'credit_customer' → a dispute_clients id). An invite grants nothing
--                by itself; the server links the new account from THIS row after the
--                account exists — never from anything the browser sent.
--   A guard trigger: code_hash / email / binding / expiry are fixed once written;
--                status moves only pending→accepted, pending→revoked, or (release,
--                before any account was recorded) accepted→pending.
--   claim_signup_invite / release_signup_invite / revoke_signup_invite —
--                SECURITY DEFINER, EXECUTE for service_role ONLY. The claim is one
--                atomic UPDATE … RETURNING, so two racing requests cannot both win.
--
-- NOT DONE HERE (owner actions, see TMMT_ACCOUNT_PROVISIONING_ARCHITECTURE.md):
--   turning public sign-up OFF in Supabase Auth, and requiring email confirmation.
--
-- ROLLBACK
--   drop function if exists public.claim_signup_invite(text, text);
--   drop function if exists public.release_signup_invite(uuid);
--   drop function if exists public.revoke_signup_invite(uuid, text);
--   drop trigger if exists signup_invites_guard on public.signup_invites;
--   drop function if exists public.signup_invites_guard();
--   alter table public.signup_invites drop constraint if exists signup_invites_binding_pair;
--   alter table public.signup_invites drop column if exists relationship_ref;
--   alter table public.signup_invites drop column if exists relationship_kind;
--   alter table public.signup_invites drop column if exists revoked_by;
--   alter table public.signup_invites drop column if exists revoked_at;
--   alter table public.signup_invites drop column if exists status;

begin;

alter table public.signup_invites add column if not exists status text not null default 'pending';
alter table public.signup_invites add column if not exists revoked_at timestamptz;
alter table public.signup_invites add column if not exists revoked_by text;
alter table public.signup_invites add column if not exists relationship_kind text;
alter table public.signup_invites add column if not exists relationship_ref text;

alter table public.signup_invites drop constraint if exists signup_invites_status_check;
alter table public.signup_invites add constraint signup_invites_status_check check (status in ('pending', 'accepted', 'revoked'));
alter table public.signup_invites drop constraint if exists signup_invites_binding_kind;
alter table public.signup_invites add constraint signup_invites_binding_kind check (relationship_kind is null or relationship_kind in ('credit_customer'));
alter table public.signup_invites drop constraint if exists signup_invites_binding_pair;
alter table public.signup_invites add constraint signup_invites_binding_pair check ((relationship_kind is null) = (relationship_ref is null));
alter table public.signup_invites drop constraint if exists signup_invites_revoked_pair;
alter table public.signup_invites add constraint signup_invites_revoked_pair check ((status = 'revoked') = (revoked_at is not null));

-- Backfill (0 rows on prod today): a used code is accepted.
update public.signup_invites set status = 'accepted' where used_at is not null and status = 'pending';

create or replace function public.signup_invites_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if (new.code_hash, new.email, new.relationship_kind, new.relationship_ref, new.expires_at, new.created_at)
     is distinct from (old.code_hash, old.email, old.relationship_kind, old.relationship_ref, old.expires_at, old.created_at) then
    raise exception 'signup_invites: code, email, binding and expiry are fixed once written' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status = 'accepted' and new.used_at is not null)
      or (old.status = 'pending' and new.status = 'revoked')
      or (old.status = 'accepted' and new.status = 'pending' and old.used_by is null and new.used_at is null)
    ) then
      raise exception 'signup_invites: % -> % is not allowed', old.status, new.status using errcode = '42501';
    end if;
  elsif new.status <> 'pending' and (new.used_at, new.used_by) is distinct from (old.used_at, old.used_by)
        and not (new.status = 'accepted' and old.used_by is null and new.used_by is not null) then
    raise exception 'signup_invites: a settled invite cannot be edited' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.signup_invites_guard() from public, anon, authenticated;
drop trigger if exists signup_invites_guard on public.signup_invites;
create trigger signup_invites_guard before update on public.signup_invites
  for each row execute function public.signup_invites_guard();

-- One atomic claim. Returns nothing unless the code is pending, unexpired, unused and
-- (when email-locked) for this email. The caller cannot tell which check failed.
create or replace function public.claim_signup_invite(p_code_hash text, p_email text)
returns table (id uuid, relationship_kind text, relationship_ref text)
language sql volatile security definer set search_path = public, pg_temp as $$
  update public.signup_invites i
     set status = 'accepted', used_at = now()
   where i.code_hash = p_code_hash
     and i.status = 'pending'
     and i.used_at is null
     and i.expires_at > now()
     and (i.email is null or lower(i.email) = lower(trim(p_email)))
  returning i.id, i.relationship_kind, i.relationship_ref
$$;

-- Hand a claim back when the account could not be created (typo'd password, email
-- already registered). Only while no account has been recorded against it.
create or replace function public.release_signup_invite(p_id uuid)
returns boolean language sql volatile security definer set search_path = public, pg_temp as $$
  with r as (
    update public.signup_invites set status = 'pending', used_at = null
     where id = p_id and status = 'accepted' and used_by is null
    returning 1)
  select exists (select 1 from r)
$$;

create or replace function public.revoke_signup_invite(p_id uuid, p_by text)
returns boolean language sql volatile security definer set search_path = public, pg_temp as $$
  with r as (
    update public.signup_invites set status = 'revoked', revoked_at = now(), revoked_by = left(p_by, 120)
     where id = p_id and status = 'pending'
    returning 1)
  select exists (select 1 from r)
$$;

revoke all on function public.claim_signup_invite(text, text) from public, anon, authenticated;
revoke all on function public.release_signup_invite(uuid) from public, anon, authenticated;
revoke all on function public.revoke_signup_invite(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_signup_invite(text, text) to service_role;
grant execute on function public.release_signup_invite(uuid) to service_role;
grant execute on function public.revoke_signup_invite(uuid, text) to service_role;

-- Keep the table closed to API roles (as today) — explicitly, in case of drift.
alter table public.signup_invites enable row level security;
revoke all on public.signup_invites from anon, authenticated;

commit;
