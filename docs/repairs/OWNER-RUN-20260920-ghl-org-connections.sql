-- ═══════════════════════════════════════════════════════════════════════════════════
-- OWNER-RUN — GHL per-org routing, 2026-09-20
--
-- WHAT THIS FIXES. src/lib/ghl/org-location.ts calls the RPC `org_ghl_location`.
-- That function DOES NOT EXIST in production: its migration has been sitting in
-- supabase/migrations/_staged/ since 2026-08-27, written and never applied, while the
-- code that depends on it shipped.
--
-- The resolver logs the failure and returns null, so every caller falls back to the single
-- env location. The data agrees exactly: all 1,656 rows in ghl_contacts carry one location,
-- Xcd8DZt5T4GWnBtBEC5V. Nothing is broken today because there is one operator. It is the
-- blocker the moment there are two.
--
-- REHEARSED on xcjuohpmtdywgzdxkssb 2026-09-20. Three constraints watched refusing:
--   G1  a subaccount carrying its own credential          -> REFUSED
--   G2  a foreign agency with NO credential               -> REFUSED
--   G3  two orgs pointing at the same GHL location        -> REFUSED
-- and the resolver returned the right location+mode for each org, and NO row for an org
-- with no connection (which is the correct "fall back to env" answer, not an error).
--
-- ROLLBACK:
--   drop function if exists public.org_ghl_location(uuid);
--   drop table if exists public.org_ghl_connections;
-- Dropping them returns the system to exactly today's behaviour — single env location.
-- ═══════════════════════════════════════════════════════════════════════════════════

begin;

\i supabase/migrations/_staged/20260827000001_org_ghl_connections_STAGED.sql

-- ── SEED: the one connection that exists today ─────────────────────────────────────
-- TMMT RENTALS already owns location Xcd8DZt5T4GWnBtBEC5V — every contact in the system
-- carries it. Recording it makes the resolver return the real answer instead of falling
-- through to env, which is the whole point.
--
-- mode = 'subaccount': it is inside our agency and our GHL_API_KEY authorizes it, so it
-- must NOT carry a second credential (constraint G1 enforces that).
insert into public.org_ghl_connections (org_id, location_id, mode, label)
values (
  '8e651b25-e7c8-4356-af64-1716a82053b0',
  'Xcd8DZt5T4GWnBtBEC5V',
  'subaccount',
  'TMMT RENTALS (main)'
)
on conflict (org_id) do nothing;

commit;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- VERIFY (all three should read as described)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- select * from public.org_ghl_location('8e651b25-e7c8-4356-af64-1716a82053b0');
--     -> one row: Xcd8DZt5T4GWnBtBEC5V / subaccount
-- select count(*) from public.org_ghl_connections;                       -- 1
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname='org_ghl_location';           -- 1
--
-- Then the app stops logging "[ghl] org location lookup failed" on every org-scoped call.
--
-- ═══════════════════════════════════════════════════════════════════════════════════
-- ADDING A SECOND OPERATOR LATER
-- ═══════════════════════════════════════════════════════════════════════════════════
-- If they are a sub-account inside our agency:
--   insert into public.org_ghl_connections (org_id, location_id, mode, label)
--   values ('<their-org-uuid>', '<their-location-id>', 'subaccount', '<name>');
--
-- If they own their agency (Khan Strategies does), the credential must live in Vault and
-- be referenced — our token has no business there and ghlAuthForTarget() will refuse to
-- hand it over:
--   insert into public.org_ghl_connections (org_id, location_id, mode, credential_secret_id, label)
--   values ('<their-org-uuid>', '<their-location-id>', 'foreign_agency', '<vault-secret-uuid>', '<name>');
