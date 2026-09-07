-- CORRECTION to 20260906022156_agent_jobs_lease_fencing.sql, applied about a
-- minute later, after that migration's postcondition query failed.
--
-- WHAT WENT WRONG
--   The fencing migration ended with `revoke all on function ... from public`,
--   on the assumption that this removes anon and authenticated. It does not.
--   This database carries ALTER DEFAULT PRIVILEGES that grant EXECUTE on new
--   functions in schema public to anon, authenticated and service_role as
--   EXPLICIT grantees, not via PUBLIC. Revoking PUBLIC therefore removed a
--   grant that was never the one doing the work.
--
--   Observed ACL immediately after that migration:
--     {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
--   This is the exact mirror of failure mode #1 in
--   docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md. There, `REVOKE ... FROM
--   anon` no-opped because the grant came from PUBLIC. Here, `REVOKE ... FROM
--   PUBLIC` no-opped because the grants are explicit. Same lesson, opposite
--   direction: read the acl column, never assume which grantee is load-bearing.
--
-- WHY IT MATTERED
--   All four agent_wp_* functions are SECURITY DEFINER. Their internal guard is
--   `if auth.uid() is not null and not is_platform_admin() then raise`, which
--   stops an authenticated non-admin but NOT anon: for anon, auth.uid() is
--   null, so the guard passes and the body runs. Combined with the accidental
--   grant, an anonymous PostgREST caller could have reached
--   /rest/v1/rpc/agent_wp_complete.
--
--   Nothing was exercised. No worker exists, and agent_jobs held only 24
--   'skipped' and 1 'done' for the whole window, which was roughly one minute.
--
--   auth.uid() cannot distinguish anon from service_role -- it is null for
--   both -- so the ACL is the only reliable discriminator. That is why the
--   pre-existing job functions carry {postgres,service_role} and nothing else.
--   Matching them exactly.
--
-- POSTCONDITION (verified, not assumed)
--   agent_wp_claim/complete/fail : {postgres=X/postgres,service_role=X/postgres}
--   agent_wp_reap                : {postgres=X/postgres}   -- cron-driven only
--   anon/authenticated EXECUTE on any agent_wp_* : 0 functions
--   Supabase security advisors report no agent_wp_* function under either
--   anon_security_definer_function_executable or
--   authenticated_security_definer_function_executable.

revoke execute on function public.agent_wp_claim(text, integer, interval)       from anon, authenticated;
revoke execute on function public.agent_wp_complete(bigint, text, bigint, text) from anon, authenticated;
revoke execute on function public.agent_wp_fail(bigint, text, bigint, text)     from anon, authenticated;
revoke execute on function public.agent_wp_reap()                               from anon, authenticated, service_role;
