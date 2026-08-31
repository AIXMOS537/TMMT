-- Lock down the credit dispute engine.
--
-- 20260707120000_dispute_engine.sql creates nine tables and contains not one
-- row-level-security statement: no `enable row level security`, no policy, no
-- grant, no revoke. The two migrations that hardened the other sensitive
-- tables — 20260822000000_add_missing_rls_policies.sql and
-- 20260828000000_sensitive_tables_admin_only.sql — do not mention any of them.
-- So the most sensitive schema in this project is the one piece of it with no
-- access rules at all.
--
-- What is in there: social-security last four, dates of birth, current and
-- previous home addresses, phone, email, all three bureau scores, raw bureau
-- report JSON, screen captures, creditor names and masked account numbers,
-- delinquency dates, and signed CROA contracts with their monthly fee.
--
-- Same shape and the same helper as the 2026-08-25 hardening, so the rule is
-- one rule across every sensitive table rather than a second dialect here.
-- Idempotent: safe to run more than once, and safe if a policy already exists.
--
-- NOT YET APPLIED to uapxakmlwnpfsftfeezx. Apply it deliberately, because
-- enabling RLS on a table with no policy denies everyone but the service role —
-- which is the correct fail-closed direction, but it will stop any reader you
-- did not expect. Today the app touches only credit_profiles, and only through
-- one dead code path (src/lib/credit-dispute/journey-bridge.ts, which nothing
-- imports), so nothing in the running app should notice.
--
-- Note that this does NOT solve the other half of the problem: the credit
-- dispute feature does not use these tables. It keeps its clients in the
-- browser's localStorage under "aix-dispute-clients"
-- (src/lib/credit-dispute/data/store.ts). Real client PII lives one cleared
-- cache away from gone, and is not covered by any policy because it is not in
-- the database at all. That is a separate change.

-- ── the nine dispute-engine tables ───────────────────────────────────────────
alter table public.credit_profiles      enable row level security;
alter table public.credit_reports       enable row level security;
alter table public.tradelines           enable row level security;
alter table public.negative_items       enable row level security;
alter table public.dispute_rounds       enable row level security;
alter table public.dispute_protocol_runs enable row level security;
alter table public.credit_score_history enable row level security;
alter table public.removal_results      enable row level security;
alter table public.croa_contracts       enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'credit_profiles',
    'credit_reports',
    'tradelines',
    'negative_items',
    'dispute_rounds',
    'dispute_protocol_runs',
    'credit_score_history',
    'removal_results',
    'croa_contracts'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_only', t);
    execute format(
      'create policy %I on public.%I as permissive for all to authenticated '
      'using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t || '_admin_only', t
    );
  end loop;
end
$$;

-- anon has no business here at all; be explicit rather than relying on the
-- absence of a policy, which is easy to undo by accident later.
revoke all on public.credit_profiles       from anon;
revoke all on public.credit_reports        from anon;
revoke all on public.tradelines            from anon;
revoke all on public.negative_items        from anon;
revoke all on public.dispute_rounds        from anon;
revoke all on public.dispute_protocol_runs from anon;
revoke all on public.credit_score_history  from anon;
revoke all on public.removal_results       from anon;
revoke all on public.croa_contracts        from anon;
