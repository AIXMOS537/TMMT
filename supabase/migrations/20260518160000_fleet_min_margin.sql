ALTER TABLE public.fleet
  ADD COLUMN IF NOT EXISTS min_margin_percent numeric(5, 2) DEFAULT 8.0;

COMMENT ON COLUMN public.fleet.min_margin_percent IS
  'Minimum vehicle-rent margin % — discounts below floor should refer to other units.';
