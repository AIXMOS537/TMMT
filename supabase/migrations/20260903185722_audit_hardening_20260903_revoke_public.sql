-- Applied to production 2026-09-03 with owner approval (version 20260903185722).
-- Follow-up to 20260903185639_audit_hardening_20260903.sql.
--
-- WHY THIS EXISTS: the first migration used "REVOKE ... FROM anon", which was a
-- no-op for eight of these functions. Their EXECUTE came from the PUBLIC grant
-- (proacl entry "=X/postgres"), and anon inherits it through PUBLIC. Verified
-- after the fact: has_function_privilege('anon', ...) was still true for all
-- eight until this ran.
--
-- Verified safe before running: authenticated and service_role each hold their
-- OWN explicit grants (authenticated=X/postgres, service_role=X/postgres) on
-- every function below, so revoking PUBLIC removes anon and nothing else. In
-- particular is_platform_admin() stays callable by authenticated users, which
-- is how lib/queries.ts:240 uses it.
--
-- The seven trigger functions do not need EXECUTE to fire from a trigger.
--
-- LESSON: when revoking from anon in Supabase, check pg_proc.proacl first. A
-- grant to PUBLIC is the common case, and "REVOKE ... FROM anon" will not touch
-- it -- the revoke reports success and changes nothing.

revoke execute on function public.auto_route_intake()          from public;
revoke execute on function public.capture_form_intake()        from public;
revoke execute on function public.capture_lead_intake()        from public;
revoke execute on function public.expense_fill_from_vehicle()  from public;
revoke execute on function public.lead_to_active_customer()    from public;
revoke execute on function public.notify_new_fleet_vehicle()   from public;
revoke execute on function public.on_new_lead()                from public;
revoke execute on function public.is_platform_admin()          from public;
