-- Worker Recovery Phase 1 (owner-approved 2026-09-16): scoped login for the
-- BRAINIAC agent_jobs worker. APPLIED to prod as ledger version 20260916191024
-- by the worker-recovery session; exact applied body kept verbatim in
-- docs/repairs/agent-worker-scoped-login.applied.sql.
--
-- This repo form grants the same privileges but is guarded so a fresh
-- environment builds: the role is created only if absent, and each EXECUTE grant
-- only if its queue function exists (agent_wp_* are not yet in repo migrations).
-- No password here: it is set out of band from a SCRAM verifier. The worker's
-- connection secret lives in a DPAPI blob on BRAINIAC, never in a repository.
--
-- 2026-09-16 follow-up (least_privilege_exec_va_tasks_agent_rpcs) removed the
-- role's inherited PUBLIC EXECUTE on agent_open_load / pick_idle_closer /
-- agent_render_prompt. Residual open finding: PUBLIC EXECUTE on pg_net.
--
-- Rollback: revoke the three grants, then drop role agent_worker.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent_worker') then
    create role agent_worker with
      login noinherit nosuperuser nocreatedb nocreaterole nobypassrls noreplication
      connection limit 2;
  end if;

  alter role agent_worker set statement_timeout = '30s';
  alter role agent_worker set idle_in_transaction_session_timeout = '60s';
  grant usage on schema public to agent_worker;

  if to_regprocedure('public.agent_wp_claim(text, integer, interval)') is not null then
    grant execute on function public.agent_wp_claim(text, integer, interval) to agent_worker;
  end if;
  if to_regprocedure('public.agent_wp_complete(bigint, text, bigint, text)') is not null then
    grant execute on function public.agent_wp_complete(bigint, text, bigint, text) to agent_worker;
  end if;
  if to_regprocedure('public.agent_wp_fail(bigint, text, bigint, text)') is not null then
    grant execute on function public.agent_wp_fail(bigint, text, bigint, text) to agent_worker;
  end if;

  comment on role agent_worker is
    'TMMT BRAINIAC agent_jobs worker. EXECUTE on agent_wp_claim/complete/fail only. Phase 1, 2026-09-16.';
end $$;
