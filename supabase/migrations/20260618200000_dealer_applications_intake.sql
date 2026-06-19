-- Dealer applications — the /apply front door with the qualification gate.
-- Same public-form pattern as team_onboarding/incoming_leads: anon INSERT only, staff read/manage.
-- Idempotent: safe to replay.
CREATE TABLE IF NOT EXISTS public.dealer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  dealership_name text NOT NULL,
  owner_name text NOT NULL,
  phone text NOT NULL,
  email text,
  city_state text,
  -- the gate (non-negotiables, confirmed in the form)
  licensed_dealer boolean NOT NULL DEFAULT false,
  has_real_lot boolean NOT NULL DEFAULT false,
  plays_fair boolean NOT NULL DEFAULT false,
  mission_accepted boolean NOT NULL DEFAULT false,
  confidentiality_agreed boolean NOT NULL DEFAULT false,
  -- judgment info (owner reviews)
  license_number text,
  years_in_business text,
  units_on_lot text,
  biggest_struggle text,
  interested_tier text,
  -- meta
  qualifies boolean NOT NULL DEFAULT false,
  device text,
  source text,
  status text NOT NULL DEFAULT 'New Application'
);

ALTER TABLE public.dealer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_dealer_applications" ON public.dealer_applications;
CREATE POLICY "anon_insert_dealer_applications"
  ON public.dealer_applications FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "staff_all_dealer_applications" ON public.dealer_applications;
CREATE POLICY "staff_all_dealer_applications"
  ON public.dealer_applications FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_dealer_applications_created_at
  ON public.dealer_applications (created_at DESC);
