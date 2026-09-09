-- ===========================================================================
-- TRIAGED 2026-09-09: NOT APPLIED, and never will be from this file.
-- Confirmed against production: exec_va_tasks has the triage columns and the
-- corrected 20260903185639 / 20260903185722 are recorded. This draft's own
-- header is right - two statements in it are wrong and it would abort.
-- Section 5 (cron.unschedule) remains the one open owner decision here.
-- Kept as the record of what was proposed. Do not run.
-- ===========================================================================

-- ============================================================================
-- ⚠️ SUPERSEDED DRAFT — DO NOT RUN.
--
-- Sections 1-4 WERE applied to production on 2026-09-03 with owner approval,
-- but NOT as written here. Two statements in this draft were wrong:
--   * sections 1-2: "REVOKE ... FROM anon" was a NO-OP for eight functions --
--     their EXECUTE came from the PUBLIC grant, which anon inherits.
--   * section 4: all three function signatures were wrong (they take
--     arguments). ALTER FUNCTION on a missing signature aborts the migration.
--
-- The corrected, applied versions live in supabase/migrations/ as:
--     20260903185639_audit_hardening_20260903.sql
--     20260903185722_audit_hardening_20260903_revoke_public.sql
--
-- Section 5 (cron.unschedule) was NOT run and remains an open owner decision.
-- Kept only as the record of what was proposed. See _staged/README.md.
--
-- Every statement below was checked against live production first:
--   * the trigger functions really do return `trigger`
--   * the three identity helpers are only ever called with the SERVICE-ROLE
--     client (src/lib/platform/request-org.ts:41) or by an authenticated
--     user, so revoking `anon` breaks no live call path
--   * no RLS policy on any table references them for anon/public
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Revoke anon EXECUTE on seven TRIGGER functions.
--
-- These return `trigger`. PostgREST will not expose a trigger-returning
-- function as an RPC endpoint, so this is not a live hole — but the GRANT is
-- wrong, the Supabase advisor flags all seven, and a future change to any of
-- them could turn a bad grant into a real one. Revoking does NOT stop the
-- triggers firing: trigger execution never checks EXECUTE on the function.
-- ---------------------------------------------------------------------------
revoke execute on function public.auto_route_intake()          from anon;
revoke execute on function public.capture_form_intake()        from anon;
revoke execute on function public.capture_lead_intake()        from anon;
revoke execute on function public.expense_fill_from_vehicle()  from anon;
revoke execute on function public.lead_to_active_customer()    from anon;
revoke execute on function public.notify_new_fleet_vehicle()   from anon;
revoke execute on function public.on_new_lead()                from anon;


-- ---------------------------------------------------------------------------
-- 2. Revoke anon EXECUTE on three identity/tenancy helpers.
--
-- These ARE callable over REST today. They let an anonymous caller probe the
-- tenancy model: org_id_for_host() maps a hostname to an org id, and
-- is_platform_admin()/acting_org_id() disclose privilege semantics.
--
-- Verified safe to revoke — call sites all use a privileged client:
--   org_id_for_host   -> createServiceSupabase()  (request-org.ts:41)
--   acting_org_id     -> authenticated user       (api/offline/merge/route.ts:40)
--   is_platform_admin -> authenticated user       (lib/queries.ts:240)
--
-- NOT revoked, deliberately:
--   submit_customer_intake(...)  public intake by design (input-capped in
--                                20260825222235_restore_anon_intake_with_input_caps)
--   eval_money_rails(p_token)    token-gated
-- ---------------------------------------------------------------------------
revoke execute on function public.acting_org_id()              from anon;
revoke execute on function public.is_platform_admin()          from anon;
revoke execute on function public.org_id_for_host(text)        from anon;


-- ---------------------------------------------------------------------------
-- 3. outreach_touches — RLS is ON with NO policy, so it fails closed.
--
-- This is a functional outage wearing a security setting: the outreach engine
-- cannot record a touch, which is why the table holds 0 rows. Same class of
-- bug as the DNC gate fixed in 20260716105225 — read that table's comment.
--
-- Writes stay service-role only (the sender is server-side and owner-gated).
-- Internal staff get read access so the call sheet can show what was sent.
-- ---------------------------------------------------------------------------
drop policy if exists outreach_touches_staff_read on public.outreach_touches;
create policy outreach_touches_staff_read
  on public.outreach_touches
  for select
  to authenticated
  using (public.is_staff());

comment on table public.outreach_touches is
  'Outreach log. RLS enabled with NO policy until 2026-09-03, which made every '
  'read fail closed and left the table permanently empty. Writes: service_role '
  'only (sends are owner-gated server-side). Reads: internal staff.';


-- ---------------------------------------------------------------------------
-- 4. Pin search_path on the three agent-job RPCs.
--
-- Added 2026-08-31, after the earlier hardening sweep, so they reintroduced a
-- defect class the project had already cleaned up once. Note these three are
-- SECURITY INVOKER (not DEFINER), so the exposure is modest — this is hygiene,
-- and it silences three advisor warnings.
--
-- Signatures verified against production 2026-09-03; they take arguments.
-- ---------------------------------------------------------------------------
alter function public.claim_agent_job(p_worker text)             set search_path = public, pg_temp;
alter function public.finish_agent_job(p_id bigint, p_response text) set search_path = public, pg_temp;
alter function public.fail_agent_job(p_id bigint, p_error text)      set search_path = public, pg_temp;


-- ---------------------------------------------------------------------------
-- 5. OWNER DECISION — stop the runaway VA task generator.
--
-- pg_cron job 2 runs generate_va_tasks() daily at 12:00 UTC. Live counts:
--     pending      17,761   (oldest 2026-06-22, newest 2026-09-03 12:00)
--     blocked_dnc      45
--     completed         0   <-- nothing has ever consumed this queue
--
-- It has produced ~17.8k rows in 73 days and nothing drains them. That is not
-- a backlog, it is accumulation, and it makes the real queue depth unreadable.
--
-- UNCOMMENT to stop it. Nothing is deleted — the existing rows stay exactly
-- where they are, and re-enabling is one line. Left commented because turning
-- off a scheduled job is your call, not the audit's.
-- ---------------------------------------------------------------------------
-- select cron.unschedule(2);
--
-- To re-enable later:
-- select cron.schedule('generate_va_tasks', '0 12 * * *', 'select public.generate_va_tasks();');


-- ---------------------------------------------------------------------------
-- 6. NOT FIXABLE IN SQL — one dashboard toggle.
--
-- Supabase Auth -> Providers -> Email -> "Prevent use of leaked passwords".
-- Currently OFF. Turn it on; it checks new passwords against HaveIBeenPwned.
-- ---------------------------------------------------------------------------
