-- STAGED 2026-09-08 (owner review; not applied). Decision sheet:
-- ~/Brain/vault/02-Needs-You/ADVISOR-KEEP-OR-REVOKE-DECISION-2026-09-08.md
--
-- Revokes EXECUTE from public/anon/authenticated on 11 SECURITY DEFINER functions that no signed-in
-- user ever calls: 7 trigger functions (triggers fire regardless of the caller's EXECUTE grant, see
-- 20260825220843), 2 RPCs reached only through the service-role client (tmmt_token_grant,
-- org_id_for_host), and 2 helpers referenced only from inside other SECURITY DEFINER functions
-- (app_auth_role, is_partner). service_role keeps its grant.
--
-- Self-verifying: a function is revoked ONLY if it exists and has zero live references from RLS
-- policies, views, or SECURITY INVOKER functions (which would run as the end user). Anything with
-- a reference is left untouched with a NOTICE, so a policy added after the 2026-09-01 baseline can
-- never be broken by this file. Rollback per function:
--   grant execute on function public.<signature> to authenticated;
do $stage$
declare
  sig   text;
  fname text;
  refs  integer;
begin
  foreach sig in array array[
    'on_new_lead()', 'auto_route_intake()', 'capture_form_intake()', 'capture_lead_intake()',
    'expense_fill_from_vehicle()', 'lead_to_active_customer()', 'notify_new_fleet_vehicle()',
    'tmmt_token_grant(uuid,integer,text,text,integer,text)', 'org_id_for_host(text)',
    'app_auth_role()', 'is_partner()'
  ] loop
    if to_regprocedure('public.' || sig) is null then
      raise notice 'revoke_user_execute: public.% absent; skipped', sig;
      continue;
    end if;
    fname := split_part(sig, '(', 1);
    select (select count(*) from pg_policies p
             where p.qual ~ (fname || '\(') or p.with_check ~ (fname || '\('))
         + (select count(*) from pg_views v
             where v.schemaname = 'public' and v.definition ~ (fname || '\('))
         + (select count(*) from pg_proc f
             where f.pronamespace = 'public'::regnamespace and f.proname <> fname
               and not f.prosecdef and f.prosrc ~ (fname || '\('))
      into refs;
    if refs > 0 then
      raise notice 'revoke_user_execute: public.% has % user-context reference(s); NOT revoked', sig, refs;
      continue;
    end if;
    execute format('revoke execute on function public.%s from public, anon, authenticated', sig);
    raise notice 'revoke_user_execute: revoked anon/authenticated execute on public.%', sig;
  end loop;
end
$stage$;

notify pgrst, 'reload schema';
