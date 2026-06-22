-- Tonight security hardening (2026-06-21)
-- 1) Close anon RPC on token grant/spend (Supabase advisor HIGH)
-- 2) Pin search_path on two INVOKER helpers (advisor MEDIUM)
-- Idempotent. submit_customer_intake stays anon — public intake by design.

-- Token RPCs: authenticated + service_role only
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tmmt_token_grant'
  ) then
    revoke execute on function public.tmmt_token_grant(uuid, integer, text, text, integer, text) from public, anon;
    grant execute on function public.tmmt_token_grant(uuid, integer, text, text, integer, text) to authenticated, service_role;
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'tmmt_token_spend'
  ) then
    revoke execute on function public.tmmt_token_spend(uuid, integer, text) from public, anon;
    grant execute on function public.tmmt_token_spend(uuid, integer, text) to authenticated, service_role;
  end if;
end $$;

-- search_path hardening (functions use public.* — verified in prod bodies)
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='agent_open_load') then
    execute 'alter function public.agent_open_load(uuid) set search_path = public';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='pick_idle_closer') then
    execute 'alter function public.pick_idle_closer(uuid) set search_path = public';
  end if;
end $$;
