-- Applied to production 2026-09-03 with owner approval (version 20260903185639).
-- From the forensic audit, SYSTEM_AUDIT_2026/.
--
-- NOTE: sections 1 and 2 below were partially ineffective as written -- see the
-- follow-up 20260903185722_audit_hardening_20260903_revoke_public.sql. The
-- grants for eight of these came from PUBLIC, not from a grant to anon, so
-- "REVOKE ... FROM anon" was a no-op for them. Kept verbatim as applied.

-- 1. Revoke anon EXECUTE on seven TRIGGER functions. They return `trigger`;
-- PostgREST never exposes those as RPC, so this is hygiene, not a live hole.
-- Revoking does not affect trigger firing.
revoke execute on function public.auto_route_intake()          from anon;
revoke execute on function public.capture_form_intake()        from anon;
revoke execute on function public.capture_lead_intake()        from anon;
revoke execute on function public.expense_fill_from_vehicle()  from anon;
revoke execute on function public.lead_to_active_customer()    from anon;
revoke execute on function public.notify_new_fleet_vehicle()   from anon;
revoke execute on function public.on_new_lead()                from anon;

-- 2. Revoke anon EXECUTE on three identity/tenancy helpers reachable over REST.
-- Call sites verified to use service-role or an authenticated user:
--   org_id_for_host   -> createServiceSupabase()  (lib/platform/request-org.ts:41)
--   acting_org_id     -> authenticated            (api/offline/merge/route.ts:40)
--   is_platform_admin -> authenticated            (lib/queries.ts:240)
-- No RLS policy references them for anon/public.
-- Deliberately NOT revoked: submit_customer_intake (public intake, input-capped
-- by 20260825222235) and eval_money_rails (token-gated).
revoke execute on function public.acting_org_id()              from anon;
revoke execute on function public.is_platform_admin()          from anon;
revoke execute on function public.org_id_for_host(text)        from anon;

-- 3. outreach_touches had RLS ON with NO policy, so every read failed closed and
-- the table stayed permanently empty -- a functional outage wearing a security
-- setting. Same class as the DNC fix in 20260716105225.
-- Writes remain service_role only; internal staff get read.
drop policy if exists outreach_touches_staff_read on public.outreach_touches;
create policy outreach_touches_staff_read
  on public.outreach_touches
  for select
  to authenticated
  using (public.is_staff());

comment on table public.outreach_touches is
  'Outreach log. RLS was enabled with NO policy until 2026-09-03, which made every read fail closed and left the table permanently empty. Writes: service_role only (sends are owner-gated server-side). Reads: internal staff via is_staff().';

-- 4. Pin search_path on the three agent-job RPCs. These are SECURITY INVOKER
-- (not DEFINER), so exposure is modest -- hygiene, and it clears three advisor
-- warnings reintroduced on 2026-08-31 after the earlier hardening sweep.
alter function public.claim_agent_job(p_worker text)                  set search_path = public, pg_temp;
alter function public.finish_agent_job(p_id bigint, p_response text)  set search_path = public, pg_temp;
alter function public.fail_agent_job(p_id bigint, p_error text)       set search_path = public, pg_temp;
