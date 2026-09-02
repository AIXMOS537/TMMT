-- Preferred vendor onboarding: service verticals + agreement tracking
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS service_verticals text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS agreement_status text NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.vendors.service_verticals IS
  'TMMT verticals this vendor fulfills: cleaning, moving, detailing, etc.';

COMMENT ON COLUMN public.vendors.agreement_status IS
  'pending | trial | active | suspended';

CREATE INDEX IF NOT EXISTS vendors_service_verticals_gin
  ON public.vendors USING gin (service_verticals);
