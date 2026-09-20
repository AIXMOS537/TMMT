-- Staff policies were targeted at PUBLIC, so they ran for anonymous visitors too.
--
-- A permissive policy with no role list applies to PUBLIC — every role, anon
-- included. Postgres evaluates all permissive policies for the command and ORs the
-- results, so these staff policies were evaluated on every anonymous read. Their
-- expressions call is_staff() / is_org_member() / acting_org_id(), and since
-- 20260903185639_audit_hardening revoked anon EXECUTE on those, the evaluation does
-- not return false — it raises:
--
--     42501  permission denied for function is_staff
--
-- and the whole statement fails. So `vehicles_anon_browse` (USING active = true),
-- which exists precisely to let the public see the fleet, could never return a row:
-- a sibling policy aimed at staff killed the query before it mattered.
--
-- Six tables carry the pattern, and they are the public-facing ones: the fleet, the
-- service list, marketplace listings, and the pricing rules.
--
-- Retargeting to `authenticated` is the fix and is also a tightening — a staff rule
-- has no business being evaluated for anonymous visitors. ALTER POLICY changes only
-- the role list, so every USING and WITH CHECK expression is preserved byte for byte
-- rather than being retyped from a query result. service_role is unaffected: it
-- bypasses RLS entirely.

alter policy vehicles_org_all                       on public.vehicles                       to authenticated;
alter policy vehicles_staff_write                   on public.vehicles                       to authenticated;
alter policy services_org_all                       on public.services                       to authenticated;
alter policy services_staff_write                   on public.services                       to authenticated;
alter policy marketplace_listings_org_all           on public.marketplace_listings           to authenticated;
alter policy marketplace_listings_staff             on public.marketplace_listings           to authenticated;
alter policy pricing_rules_org_all                  on public.rental_pricing_rules           to authenticated;
alter policy credit_funding_sessions_org_all        on public.credit_funding_sessions        to authenticated;
alter policy vehicle_onboarding_inspections_org_all on public.vehicle_onboarding_inspections to authenticated;
