-- Read-only login for the production-baton enforcement hook (owner-approved
-- 2026-09-16, decision 2). The hook must be able to read baton state without
-- holding any powerful credential.
--
-- baton_reader can do exactly one thing: EXECUTE ops.prod_baton_status().
-- No table privileges, no BYPASSRLS, no INHERIT, connection limit 3, 5 s statement
-- timeout. It cannot acquire, release or recover a baton.
-- The password is NOT set here: it is generated on BRAINIAC, stored DPAPI-encrypted
-- for the Windows user, and only its SCRAM-SHA-256 verifier is sent with
-- `alter role baton_reader password '<verifier>'` (DDL is logged).
-- It also loses PUBLIC's EXECUTE on the agent helper functions already revoked in
-- 20260916193847; pg_net PUBLIC EXECUTE remains an open finding for every role.
--
-- Rollback: revoke execute/usage below, then drop role baton_reader.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'baton_reader') then
    create role baton_reader with
      login noinherit nosuperuser nocreatedb nocreaterole nobypassrls noreplication
      connection limit 3;
  end if;
  alter role baton_reader set statement_timeout = '5s';
  alter role baton_reader set idle_in_transaction_session_timeout = '10s';

  if to_regnamespace('ops') is not null then
    grant usage on schema ops to baton_reader;
    if to_regprocedure('ops.prod_baton_status()') is not null then
      grant execute on function ops.prod_baton_status() to baton_reader;
    end if;
  end if;

  comment on role baton_reader is
    'Production-baton hook: EXECUTE ops.prod_baton_status() only. 2026-09-16.';
end $$;
