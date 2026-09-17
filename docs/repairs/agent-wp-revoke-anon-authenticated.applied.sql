-- VERBATIM body applied to prod (uapxakmlwnpfsftfeezx) as ledger version
-- 20260906022251 agent_wp_revoke_anon_authenticated (2026-09-06).
-- Copied from supabase_migrations.schema_migrations.statements[1]. Historical
-- record only: do NOT run. The fresh-environment-safe form is in
-- supabase/migrations/20260906022251_agent_wp_revoke_anon_authenticated.sql.
-- Everything after the marker line below is byte-identical to the ledger body
-- (md5 942c28b4efc2c0c64c419c7f2f3a2ec2; checked by
-- scripts/tests/sql/agent-queue-migrations.rehearsal.mjs --verify-verbatim).
-- ===== VERBATIM BODY BELOW =====
-- CORRECTION to agent_jobs_lease_fencing, applied immediately after its
-- postcondition query failed.
--
-- WHAT WENT WRONG
--   The fencing migration ended with `revoke all on function ... from public`,
--   on the assumption that this removes anon and authenticated. It does not.
--   This database carries ALTER DEFAULT PRIVILEGES that grant EXECUTE on new
--   functions in schema public to anon, authenticated and service_role as
--   EXPLICIT grantees, not via PUBLIC. Revoking PUBLIC therefore removed a
--   grant that was never the one doing the work.
--
--   Observed ACL after that migration:
--     {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
--   This is the exact mirror of failure mode #1 in
--   docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md: there, a REVOKE FROM anon
--   no-opped because the grant came from PUBLIC. Here, a REVOKE FROM PUBLIC
--   no-opped because the grants are explicit.
--
-- WHY IT MATTERED
--   All four agent_wp_* functions are SECURITY DEFINER. Their internal guard is
--   `if auth.uid() is not null and not is_platform_admin() then raise`, which
--   stops an authenticated non-admin but NOT anon -- for anon, auth.uid() is
--   null, so the guard passes and the body runs. Combined with the accidental
--   grant, an anonymous PostgREST caller could have completed or failed jobs.
--   No worker exists yet and no job was queued or running, so nothing was
--   exercised; the window was minutes and the queue was inert.
--
--   auth.uid() cannot distinguish anon from service_role -- both are null. The
--   ACL is therefore the only reliable discriminator, which is why the older
--   functions carry {postgres,service_role} and nothing else. Matching them.

revoke execute on function public.agent_wp_claim(text, integer, interval)       from anon, authenticated;
revoke execute on function public.agent_wp_complete(bigint, text, bigint, text) from anon, authenticated;
revoke execute on function public.agent_wp_fail(bigint, text, bigint, text)     from anon, authenticated;
revoke execute on function public.agent_wp_reap()                               from anon, authenticated, service_role;