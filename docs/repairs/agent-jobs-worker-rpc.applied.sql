-- VERBATIM body applied to prod (uapxakmlwnpfsftfeezx) as ledger version
-- 20260831190848 agent_jobs_worker_rpc (2026-08-31).
-- Copied from supabase_migrations.schema_migrations.statements[1]. Historical
-- record only: do NOT run. The fresh-environment-safe form is in
-- supabase/migrations/20260831190848_agent_jobs_worker_rpc.sql.
-- Everything after the marker line below is byte-identical to the ledger body
-- (md5 39535289fc4dd7dd5a7c99fdbb9c7970; checked by
-- scripts/tests/sql/agent-queue-migrations.rehearsal.mjs --verify-verbatim).
-- ===== VERBATIM BODY BELOW =====
-- Worker RPC for the local (free) agent runner on the M1.
-- 2026-08-31. Lets an always-on local worker claim, finish and fail agent_jobs
-- atomically. No behaviour change to existing rows; purely additive.

-- Claim exactly one queued job. FOR UPDATE SKIP LOCKED makes concurrent workers
-- safe: two boxes can never take the same job.
create or replace function public.claim_agent_job(p_worker text)
returns public.agent_jobs
language plpgsql
as $$
declare
  j public.agent_jobs;
begin
  update public.agent_jobs a
     set status     = 'running',
         claimed_by = p_worker,
         claimed_at = now(),
         attempts   = a.attempts + 1
   where a.id = (
     select id from public.agent_jobs
      where status = 'queued'
      order by created_at
      limit 1
      for update skip locked
   )
  returning a.* into j;
  return j;
end;
$$;

-- Finish a job: store the response, mark done, and write the agent's answer
-- into the target field on the source row. source_table/target_field come from
-- agent_definitions (owner-controlled), and are quoted as identifiers.
create or replace function public.finish_agent_job(p_id bigint, p_response text)
returns void
language plpgsql
as $$
declare
  j public.agent_jobs;
  d public.agent_definitions;
  v_ans text;
begin
  select * into j from public.agent_jobs where id = p_id;
  if not found then raise exception 'agent_jobs % not found', p_id; end if;

  select * into d from public.agent_definitions where slug = j.agent_slug;

  update public.agent_jobs
     set status = 'done', response = p_response, error = null, finished_at = now()
   where id = p_id;

  -- Only write back when the definition says where to, and only if still null.
  if d.target_field is not null and d.source_table is not null then
    v_ans := btrim(p_response);
    execute format(
      'update public.%I set %I = $1 where id::text = $2 and %I is null',
      d.source_table, d.target_field, d.target_field
    ) using v_ans, j.record_id;
  end if;
end;
$$;

-- Fail a job: back to queued for another go, or 'failed' once attempts run out.
create or replace function public.fail_agent_job(p_id bigint, p_error text)
returns void
language plpgsql
as $$
declare
  j public.agent_jobs;
  max_a int;
begin
  select * into j from public.agent_jobs where id = p_id;
  if not found then return; end if;
  select coalesce(max_attempts, 3) into max_a
    from public.agent_definitions where slug = j.agent_slug;
  if j.attempts >= coalesce(max_a, 3) then
    update public.agent_jobs
       set status = 'failed', error = p_error, finished_at = now() where id = p_id;
  else
    update public.agent_jobs
       set status = 'queued', error = p_error, claimed_by = null, claimed_at = null
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.claim_agent_job(text)          from public, anon, authenticated;
revoke all on function public.finish_agent_job(bigint, text)  from public, anon, authenticated;
revoke all on function public.fail_agent_job(bigint, text)    from public, anon, authenticated;
grant execute on function public.claim_agent_job(text)         to service_role;
grant execute on function public.finish_agent_job(bigint, text) to service_role;
grant execute on function public.fail_agent_job(bigint, text)   to service_role;