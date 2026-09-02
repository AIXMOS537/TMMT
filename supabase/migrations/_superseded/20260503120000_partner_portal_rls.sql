-- Partner / investor portal: staff-scoped RLS + partner scoped read RPC
-- After applying: set app_metadata.role for each Auth user (`admin`, `va`, or `partner`).
-- Users with missing/empty role are treated as staff (legacy compatibility).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual only — do not run as part of forward migrations)
-- ═══════════════════════════════════════════════════════════════════════════
-- Use this if you applied this file and need to restore the previous RLS model
-- (any authenticated user = full access on staff tables, no partner RPC).
--
-- Also revert the Next.js app (Git) to a commit before partner portal, or
-- partners will still be redirected to /partner while DB allows broad access.
--
-- Suggested order (run in Supabase SQL Editor as one script after review):
--   1) Drop every staff_all_* policy below (Step A).
--   2) Recreate every auth_all_* policy from Step B (matches 20260331_enable_rls.sql).
--   3) Drop RPC + role helpers (Step C). If Postgres complains, drop policies first.
--   4) DROP TABLE partner_fleet_access (Step D).
--   5) DROP COLUMN partner_portal_notes on fleet (Step E).
--
-- Easiest full restore: restore a Supabase backup taken before this migration, then
-- skip re-running this file. Narrative: README.md → "Release: partner portal…" → Rollback.
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════
-- Fleet: optional notes visible only through partner-safe RPC/view path
-- ════════════════════════════════════════════════════

ALTER TABLE public.fleet ADD COLUMN IF NOT EXISTS partner_portal_notes text;

-- ════════════════════════════════════════════════════
-- Partner ↔ fleet linkage (maintained by staff)
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.partner_fleet_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fleet_id uuid NOT NULL REFERENCES public.fleet (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_user_id, fleet_id)
);

CREATE INDEX IF NOT EXISTS partner_fleet_access_partner_idx
  ON public.partner_fleet_access (partner_user_id);

CREATE INDEX IF NOT EXISTS partner_fleet_access_fleet_idx
  ON public.partner_fleet_access (fleet_id);

COMMENT ON TABLE public.partner_fleet_access IS
  'Maps Supabase Auth users with app_metadata.role=partner to fleet vehicles they may view via get_partner_fleet().';

ALTER TABLE public.partner_fleet_access ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════
-- Role helpers (JWT app_metadata.role) — before policies referencing them
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.app_auth_role ()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')), '');
$$;

CREATE OR REPLACE FUNCTION public.is_staff ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(nullif(trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')), ''), 'admin'::text)
    IN ('admin', 'va');
$$;

CREATE OR REPLACE FUNCTION public.is_partner ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')) = 'partner'::text;
$$;

CREATE POLICY "staff_all_partner_fleet_access"
  ON public.partner_fleet_access
  FOR ALL
  TO authenticated
  USING (public.is_staff ())
  WITH CHECK (public.is_staff ());

-- ════════════════════════════════════════════════════
-- Partner-safe fleet projection (SECURITY DEFINER)
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_partner_fleet ()
RETURNS TABLE (
  fleet_id uuid,
  vehicle_name text,
  vehicle_make text,
  vehicle_model text,
  year integer,
  vehicle_status text,
  color text,
  partner_percentage numeric,
  partner_portal_notes text,
  last_updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.vehicle_name,
    f.vehicle_make,
    f.vehicle_model,
    f.year,
    f.vehicle_status,
    f.color,
    f.partner_percentage,
    f.partner_portal_notes,
    coalesce(f.updated_at, f.created_at)
  FROM public.fleet f
  INNER JOIN public.partner_fleet_access pfa
    ON pfa.fleet_id = f.id
   AND pfa.partner_user_id = auth.uid ()
  WHERE public.is_partner ();
$$;

REVOKE ALL ON FUNCTION public.get_partner_fleet () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_fleet () TO authenticated;

-- ════════════════════════════════════════════════════
-- Replace broad authenticated policies with staff-only
-- ════════════════════════════════════════════════════

-- incoming_leads
DROP POLICY IF EXISTS "auth_all_leads" ON incoming_leads;
CREATE POLICY "staff_all_leads" ON incoming_leads FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- background_checks
DROP POLICY IF EXISTS "auth_all_bg_checks" ON background_checks;
CREATE POLICY "staff_all_bg_checks" ON background_checks FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- waitlist
DROP POLICY IF EXISTS "auth_all_waitlist" ON waitlist;
CREATE POLICY "staff_all_waitlist" ON waitlist FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- appointments
DROP POLICY IF EXISTS "auth_all_appointments" ON appointments;
CREATE POLICY "staff_all_appointments" ON appointments FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- tickets
DROP POLICY IF EXISTS "auth_all_tickets" ON tickets;
CREATE POLICY "staff_all_tickets" ON tickets FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- customer_inspection_photos
DROP POLICY IF EXISTS "auth_all_inspections" ON customer_inspection_photos;
CREATE POLICY "staff_all_inspections" ON customer_inspection_photos FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- vehicle_handover
DROP POLICY IF EXISTS "auth_all_handovers" ON vehicle_handover;
CREATE POLICY "staff_all_handovers" ON vehicle_handover FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- vehicle_onboarding_inspections
DROP POLICY IF EXISTS "auth_all_onboarding" ON vehicle_onboarding_inspections;
CREATE POLICY "staff_all_onboarding" ON vehicle_onboarding_inspections FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- fleet
DROP POLICY IF EXISTS "auth_all_fleet" ON fleet;
CREATE POLICY "staff_all_fleet" ON fleet FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- active_customers
DROP POLICY IF EXISTS "auth_all_customers" ON active_customers;
CREATE POLICY "staff_all_customers" ON active_customers FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- customer_payments
DROP POLICY IF EXISTS "auth_all_payments" ON customer_payments;
CREATE POLICY "staff_all_payments" ON customer_payments FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- insurance
DROP POLICY IF EXISTS "auth_all_insurance" ON insurance;
CREATE POLICY "staff_all_insurance" ON insurance FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- expenses
DROP POLICY IF EXISTS "auth_all_expenses" ON expenses;
CREATE POLICY "staff_all_expenses" ON expenses FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- fleet_car_inspections
DROP POLICY IF EXISTS "auth_all_fleet_inspections" ON fleet_car_inspections;
CREATE POLICY "staff_all_fleet_inspections" ON fleet_car_inspections FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- contracts
DROP POLICY IF EXISTS "auth_all_contracts" ON contracts;
CREATE POLICY "staff_all_contracts" ON contracts FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- shops_mechanics_cleaning
DROP POLICY IF EXISTS "auth_all_vendors" ON shops_mechanics_cleaning;
CREATE POLICY "staff_all_vendors" ON shops_mechanics_cleaning FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- operation_costs
DROP POLICY IF EXISTS "auth_all_op_costs" ON operation_costs;
CREATE POLICY "staff_all_op_costs" ON operation_costs FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- do_not_rent_list
DROP POLICY IF EXISTS "auth_all_dnr" ON do_not_rent_list;
CREATE POLICY "staff_all_dnr" ON do_not_rent_list FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- former_customers
DROP POLICY IF EXISTS "auth_all_former" ON former_customers;
CREATE POLICY "staff_all_former" ON former_customers FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- maintenance_appointments
DROP POLICY IF EXISTS "auth_all_maintenance" ON maintenance_appointments;
CREATE POLICY "staff_all_maintenance" ON maintenance_appointments FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK SQL (copy into a new SQL Editor tab, UNCOMMENT, run — not part of UP)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ---- Step A: remove staff_all_* policies (uncomment to execute) ----
--
-- DROP POLICY IF EXISTS "staff_all_partner_fleet_access" ON public.partner_fleet_access;
-- DROP POLICY IF EXISTS "staff_all_leads" ON incoming_leads;
-- DROP POLICY IF EXISTS "staff_all_bg_checks" ON background_checks;
-- DROP POLICY IF EXISTS "staff_all_waitlist" ON waitlist;
-- DROP POLICY IF EXISTS "staff_all_appointments" ON appointments;
-- DROP POLICY IF EXISTS "staff_all_tickets" ON tickets;
-- DROP POLICY IF EXISTS "staff_all_inspections" ON customer_inspection_photos;
-- DROP POLICY IF EXISTS "staff_all_handovers" ON vehicle_handover;
-- DROP POLICY IF EXISTS "staff_all_onboarding" ON vehicle_onboarding_inspections;
-- DROP POLICY IF EXISTS "staff_all_fleet" ON fleet;
-- DROP POLICY IF EXISTS "staff_all_customers" ON active_customers;
-- DROP POLICY IF EXISTS "staff_all_payments" ON customer_payments;
-- DROP POLICY IF EXISTS "staff_all_insurance" ON insurance;
-- DROP POLICY IF EXISTS "staff_all_expenses" ON expenses;
-- DROP POLICY IF EXISTS "staff_all_fleet_inspections" ON fleet_car_inspections;
-- DROP POLICY IF EXISTS "staff_all_contracts" ON contracts;
-- DROP POLICY IF EXISTS "staff_all_vendors" ON shops_mechanics_cleaning;
-- DROP POLICY IF EXISTS "staff_all_op_costs" ON operation_costs;
-- DROP POLICY IF EXISTS "staff_all_dnr" ON do_not_rent_list;
-- DROP POLICY IF EXISTS "staff_all_former" ON former_customers;
-- DROP POLICY IF EXISTS "staff_all_maintenance" ON maintenance_appointments;
--
-- ---- Step B: restore auth_all_* (same definitions as 20260331_enable_rls.sql) ----
--
-- CREATE POLICY "auth_all_leads" ON incoming_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_bg_checks" ON background_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_waitlist" ON waitlist FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_appointments" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_tickets" ON tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_inspections" ON customer_inspection_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_handovers" ON vehicle_handover FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_onboarding" ON vehicle_onboarding_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_fleet" ON fleet FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_customers" ON active_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_payments" ON customer_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_insurance" ON insurance FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_fleet_inspections" ON fleet_car_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_contracts" ON contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_vendors" ON shops_mechanics_cleaning FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_op_costs" ON operation_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_dnr" ON do_not_rent_list FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_former" ON former_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "auth_all_maintenance" ON maintenance_appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
--
-- ---- Step C: drop partner RPC + JWT helpers ----
--
-- DROP FUNCTION IF EXISTS public.get_partner_fleet ();
-- DROP FUNCTION IF EXISTS public.is_partner ();
-- DROP FUNCTION IF EXISTS public.is_staff ();
-- DROP FUNCTION IF EXISTS public.app_auth_role ();
--
-- ---- Step D: remove partner ↔ fleet mapping table ----
--
-- DROP TABLE IF EXISTS public.partner_fleet_access CASCADE;
--
-- ---- Step E: remove optional fleet column added in this migration ----
--
-- ALTER TABLE public.fleet DROP COLUMN IF EXISTS partner_portal_notes;
