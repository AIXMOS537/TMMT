-- VERBATIM body applied to prod (uapxakmlwnpfsftfeezx) on 2026-09-16 as ledger
-- version 20260916191024 agent_worker_scoped_login, by the "TMMT OS growth engine
-- architecture" session under the owner's Worker Recovery Phase 1 approval.
-- Copied from supabase_migrations.schema_migrations.statements. Historical record
-- only: do NOT run. The fresh-environment-safe form is in supabase/migrations/.
-- The role password is not in this body; it was set out of band from a SCRAM
-- verifier. The worker reads its connection secret from a DPAPI blob at
-- C:\ProgramData\tmmt\agent-worker\secret\db.dpapi (not in any repository).

-- Worker Recovery Phase 1 (owner-approved 2026-09-16).
-- A dedicated database login for the BRAINIAC agent_jobs worker, replacing the
-- service-role key pattern used by the M1 worker.
--
-- Grants: EXECUTE on the three current queue functions ONLY. They are SECURITY
-- DEFINER, so no table privileges are needed. No BYPASSRLS, no INHERIT, no
-- CREATE*, at most 2 connections, 30 s statement timeout.
--
-- Residual (open finding): like every role in this database, it inherits
-- PUBLIC's EXECUTE on pg_net (net.http_*) and catalog read. It has no table data.
--
-- The password is NOT set here. It is set separately from a pre-computed
-- SCRAM-SHA-256 verifier so that no plaintext reaches migrations or the DDL log.
--
-- Rollback: drop role agent_worker;  (after revoking the three grants)

create role agent_worker with
  login noinherit nosuperuser nocreatedb nocreaterole nobypassrls noreplication
  connection limit 2;

alter role agent_worker set statement_timeout = '30s';
alter role agent_worker set idle_in_transaction_session_timeout = '60s';

grant usage on schema public to agent_worker;
grant execute on function public.agent_wp_claim(text, integer, interval)        to agent_worker;
grant execute on function public.agent_wp_complete(bigint, text, bigint, text)  to agent_worker;
grant execute on function public.agent_wp_fail(bigint, text, bigint, text)      to agent_worker;

comment on role agent_worker is
  'TMMT BRAINIAC agent_jobs worker. EXECUTE on agent_wp_claim/complete/fail only. Phase 1, 2026-09-16.';
