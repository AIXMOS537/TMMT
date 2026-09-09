-- Sweep companion to 20260909210330_ghl_webhook_events_revoke_anon.sql.
--
-- APPLIED to production 2026-09-09 21:07 UTC (schema_migrations 20260909210714).
--
-- Every table below has RLS ON with ZERO policies -- i.e. deliberately
-- service-role-only -- yet still carried Supabase's schema-wide default grant of
-- ALL privileges to anon and authenticated. RLS blocks their row-level access,
-- so reads and writes were already denied. It does NOT block TRUNCATE.
--
--   customer_payments_snapshot_20260706      31 rows, customer payment snapshot
--   exec_va_tasks_dnc_remediation_20260906  144 rows, DO-NOT-CALL remediation
--   tmmt_token_ledger                         4 rows, token ledger
--
-- The DNC table is the one that matters: truncating it would destroy the record
-- of who asked not to be contacted -- a compliance record, not just data.
--
-- No functional change: RLS already denied anon/authenticated every row-level
-- operation and nothing reaches these tables except service_role. Not reachable
-- through PostgREST either, which exposes no TRUNCATE verb. This closes the gap
-- at the grant level so it stops depending on RLS covering something it does not.
--
-- Found by this sweep, which should keep returning zero rows:
--   with t as (select c.relname tbl, c.relrowsecurity rls,
--                (select count(*) from pg_policies p
--                  where p.schemaname='public' and p.tablename=c.relname) policies
--              from pg_class c
--              where c.relnamespace='public'::regnamespace and c.relkind='r'),
--        g as (select table_name,
--                bool_or(grantee in ('anon','authenticated')) anon_granted
--              from information_schema.table_privileges
--              where table_schema='public' group by table_name)
--   select t.tbl from t join g on g.table_name=t.tbl
--   where t.rls and t.policies=0 and coalesce(g.anon_granted,false);
--
-- ROLLBACK (not recommended):
--   grant all on public.<table> to anon, authenticated;

revoke all on public.customer_payments_snapshot_20260706     from anon, authenticated;
revoke all on public.exec_va_tasks_dnc_remediation_20260906  from anon, authenticated;
revoke all on public.tmmt_token_ledger                       from anon, authenticated;
