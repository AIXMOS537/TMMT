-- Enable RLS on all tables and add policies
-- Run this in Supabase SQL Editor or via supabase db push

-- ════════════════════════════════════════════════════
-- PUBLIC FORM TABLES: anon can INSERT only
-- ════════════════════════════════════════════════════

-- incoming_leads
ALTER TABLE incoming_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_leads" ON incoming_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_leads" ON incoming_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- background_checks
ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_bg_checks" ON background_checks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_bg_checks" ON background_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_waitlist" ON waitlist FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_waitlist" ON waitlist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_appointments" ON appointments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_appointments" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_tickets" ON tickets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_tickets" ON tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- customer_inspection_photos
ALTER TABLE customer_inspection_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_inspections" ON customer_inspection_photos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_inspections" ON customer_inspection_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vehicle_handovers
ALTER TABLE vehicle_handovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_handovers" ON vehicle_handovers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_handovers" ON vehicle_handovers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vehicle_onboarding_inspection
ALTER TABLE vehicle_onboarding_inspection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_onboarding" ON vehicle_onboarding_inspection FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_onboarding" ON vehicle_onboarding_inspection FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════
-- ADMIN-ONLY TABLES: authenticated full access, no anon
-- ════════════════════════════════════════════════════

ALTER TABLE fleet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_fleet" ON fleet FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE active_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_customers" ON active_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_payments" ON customer_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_insurance" ON insurance FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_expenses" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE fleet_car_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_fleet_inspections" ON fleet_car_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_contracts" ON contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE shops_mechanics_cleaning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_vendors" ON shops_mechanics_cleaning FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE operation_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_op_costs" ON operation_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE do_not_rent_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_dnr" ON do_not_rent_list FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE former_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_former" ON former_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE maintenance_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_maintenance" ON maintenance_appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vehicle_handover ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_handover" ON vehicle_handover FOR ALL TO authenticated USING (true) WITH CHECK (true);
