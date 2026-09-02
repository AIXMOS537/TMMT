-- Lock down the credit dispute engine — whenever it actually gets created.
--
-- 20260707120000_dispute_engine.sql creates nine tables and contains not one
-- row-level-security statement: no `enable row level security`, no policy, no
-- grant, no revoke. The two migrations that hardened the other sensitive
-- tables — 20260822000000_add_missing_rls_policies.sql and
-- 20260828000000_sensitive_tables_admin_only.sql — do not mention any of them.
--
-- What that schema is for: social-security last four, dates of birth, current
-- and previous home addresses, phone, email, three bureau scores, raw bureau
-- report JSON, screen captures, creditor names and masked account numbers,
-- delinquency dates, and signed CROA contracts with their monthly fee.
--
-- Checked against uapxakmlwnpfsftfeezx on 2026-08-31: NONE of the nine exist
-- there. The dispute migration has never been applied to production. So this is
-- not repairing a live hole — it is making sure the hole never opens, on the
-- day someone finally runs 20260707120000 on a real database.
--
-- Hence the guards. Every statement is skipped when its table is absent, so
-- this runs clean today and does the right thing later, in either order.
--
-- Note what this does NOT fix. The dispute feature does not use these tables at
-- all: it keeps its clients in the browser's localStorage under
-- "aix-dispute-clients" (src/lib/credit-dispute/data/store.ts). Real client PII
-- lives one cleared cache away from gone, and no policy can reach it, because
-- it is not in a database. That is the live problem; this is the latent one.

do $$
declare
  t text;
  tables constant text[] := array[
    'credit_profiles',
    'credit_reports',
    'tradelines',
    'negative_items',
    'dispute_rounds',
    'dispute_protocol_runs',
    'credit_score_history',
    'removal_results',
    'croa_contracts'
  ];
  present int := 0;
begin
  foreach t in array tables
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %: not present in this database', t;
      continue;
    end if;

    present := present + 1;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_admin_only', t);
    execute format(
      'create policy %I on public.%I as permissive for all to authenticated '
      'using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t || '_admin_only', t
    );

    -- Explicit, rather than relying on the absence of a policy. An absence is
    -- easy to undo by accident; a revoke is a statement of intent.
    execute format('revoke all on public.%I from anon', t);
  end loop;

  raise notice 'dispute engine RLS: % of % tables were present and locked down',
    present, array_length(tables, 1);
end
$$;
