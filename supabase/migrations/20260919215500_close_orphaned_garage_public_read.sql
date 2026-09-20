-- APPLIED to production 2026-09-19.
--
-- The five garage_* tables carried `FOR SELECT USING (true)` policies for PUBLIC,
-- so anyone holding the publishable anon key could read them.
--
-- Audited 2026-09-19: NOTHING reads them. No /garage route, no page under src/app,
-- no lib — `grep -rl 'garage_builds|garage_ledger' src/` returns nothing. They hold
-- 3 builds, 16 mods, 15 gates, 8 history rows, 10 ledger entries, including a
-- driver_name and price/earned amounts in cents.
--
-- The content is not sensitive; a public read surface with zero consumers is surface
-- for nothing. Closing the policy rather than dropping the tables: THE DATA IS NOT
-- TOUCHED (row counts verified identical after), and this is one CREATE POLICY away
-- from being undone if a public garage page is ever built. Deleting rows is the
-- owner's call, not an audit's. service_role bypasses RLS, so staff access is
-- unaffected.

drop policy if exists garage_builds_public_read  on public.garage_builds;
drop policy if exists garage_gates_public_read   on public.garage_gates;
drop policy if exists garage_history_public_read on public.garage_history;
drop policy if exists garage_ledger_public_read  on public.garage_ledger;
drop policy if exists garage_mods_public_read    on public.garage_mods;

revoke all on public.garage_builds  from anon;
revoke all on public.garage_gates   from anon;
revoke all on public.garage_history from anon;
revoke all on public.garage_ledger  from anon;
revoke all on public.garage_mods    from anon;
