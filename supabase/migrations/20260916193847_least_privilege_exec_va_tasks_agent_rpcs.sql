-- Least privilege: exec_va_tasks + three agent helper functions
-- (owner-approved 2026-09-16, decision 3 and worker security follow-up).
--
-- exec_va_tasks
--   anon and authenticated held SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER.
--   RLS (single policy service_role_all) was the only thing stopping them.
--   Verified before this change:
--     * no browser/client code touches the table; the only app callers are
--       server actions using the service-role client
--       (src/app/(admin)/va-queue/actions.ts, src/lib/ops/va-task-outbox.ts)
--     * no view references it
--     * the functions that touch it are not executable by anon/authenticated:
--       generate_va_tasks(_v2) and generate_daily_brief are SECURITY DEFINER,
--       classify_va_tasks runs from pg_cron as postgres
--
-- agent_open_load(uuid), pick_idle_closer(...), agent_render_prompt(text, jsonb)
--   Executable by PUBLIC (so also anon, authenticated and the scoped agent_worker
--   login). Their only callers are SECURITY DEFINER functions owned by postgres:
--     agent_render_prompt <- agent_enqueue (triggers on expenses, intake_events)
--     pick_idle_closer    <- tg_auto_assign_lead (trigger), rebalance_stale_leads, assign_lead_idle
--     agent_open_load     <- pick_idle_closer
--   A definer function checks EXECUTE as its owner, so those chains keep working.
--   No app, control-plane or tmmt-os code calls them directly.
--
-- Guarded so a fresh environment without these objects skips cleanly.

do $$
declare
  v_fn regprocedure;
begin
  if to_regclass('public.exec_va_tasks') is not null then
    revoke all on public.exec_va_tasks from anon, authenticated;
  else
    raise notice 'exec_va_tasks not present: skipped';
  end if;

  for v_fn in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.proname in ('agent_open_load', 'pick_idle_closer', 'agent_render_prompt')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_fn);
    execute format('grant execute on function %s to service_role', v_fn);
  end loop;
end $$;
