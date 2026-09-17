-- profiles: signed-in users may edit only their own display fields.
--
-- NOT APPLIED. Owner-gated production change; acquire the prod write baton
-- (docs/ops/PROD-WRITE-BATON.md) before applying.
--
-- WHY
-- Every authorization helper reads public.profiles for the caller:
--   is_admin(), is_staff(), is_internal_ops(), is_platform_admin(), current_role(),
--   is_org_member() (organization_id + role), backend_unlocked_for() (role +
--   organization_id), current_profile_email() (email).
-- 239 policies on 130 tables call the role helpers; 21 policies on 18 tables
-- match rows to the caller through profiles.email.
--
-- Before this migration, `authenticated` held table-level INSERT/UPDATE/DELETE on
-- profiles and profiles_self_update only checked `id = auth.uid()`. Nothing
-- limited WHICH columns a user changed on their own row, so the data those
-- helpers trust was editable by the person being authorized. Checked 2026-09-17
-- against production (read-only catalog queries).
--
-- WHAT THIS DOES
-- 1. A BEFORE INSERT OR UPDATE trigger. For callers running as anon or
--    authenticated (every PostgREST request made with a user or anon key):
--      INSERT  -> rejected. Profiles are created by the signup triggers
--                 (handle_new_auth_user / handle_new_user, SECURITY DEFINER,
--                 owned by postgres) or by service_role.
--      UPDATE  -> rejected if any column other than full_name, phone or
--                 updated_at changes. The check is an ALLOWLIST over the whole
--                 row, so a column added later is protected by default.
--    Every other role passes: service_role, postgres, the auth admin, SECURITY
--    DEFINER functions owned by postgres, and foreign-key cascades (which run as
--    the table owner).
-- 2. Grants, as a second layer that does not depend on the trigger:
--    anon and authenticated lose INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and
--    TRIGGER on profiles; authenticated gets UPDATE back on (full_name, phone,
--    updated_at) only. SELECT is untouched; RLS still scopes it.
--
-- COMPATIBILITY
-- No application code writes public.profiles with a user or anon key (searched
-- src/, scripts/, supabase/functions/ on 2026-09-17: every call is a SELECT).
-- scripts/set-admin-role.mjs uses service_role and auth.admin, unaffected.
-- Deliberate behaviour change: an ADMIN's own JWT can no longer change role,
-- email or other access columns through the API either. Those changes go
-- through service_role (a script or server action) or SQL. Nothing does this
-- today. Policies are not modified.
--
-- NOT COVERED HERE (see docs/security/PROFILES-ACCESS-COLUMNS.md)
-- - Customer row matching still keys on email, not auth.uid(). With this
--   migration a user can no longer CHANGE their profile email, but whoever first
--   registers an address owns it. Safe only while Supabase Auth requires email
--   confirmation, which is a dashboard setting and was not verified.
-- - SECURITY DEFINER functions owned by postgres bypass the trigger by design.
--   A future such function that writes profiles from caller input must do its
--   own authorization.
--
-- TESTED: node scripts/tests/sql/profiles-access-columns.rehearsal.mjs
--
-- ROLLBACK (re-opens the vulnerability; do not run without a replacement):
--   drop trigger if exists profiles_block_protected_self_edits on public.profiles;
--   drop function if exists public.profiles_block_protected_self_edits();
--   grant insert, update, delete, truncate, references, trigger on public.profiles to anon, authenticated;

create or replace function public.profiles_block_protected_self_edits()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  self_editable constant text[] := array['full_name', 'phone', 'updated_at'];
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'profiles: % cannot create profiles', current_user
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - self_editable) is distinct from (to_jsonb(old) - self_editable) then
    raise exception 'profiles: % may change only full_name and phone', current_user
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.profiles_block_protected_self_edits() from public, anon, authenticated;

drop trigger if exists profiles_block_protected_self_edits on public.profiles;
create trigger profiles_block_protected_self_edits
  before insert or update on public.profiles
  for each row execute function public.profiles_block_protected_self_edits();

revoke insert, update, delete, truncate, references, trigger on public.profiles from anon, authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;
