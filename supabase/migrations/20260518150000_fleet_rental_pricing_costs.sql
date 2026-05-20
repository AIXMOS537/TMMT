-- Fleet: cost-basis fields for automatic rental rate suggestions

ALTER TABLE public.fleet
  ADD COLUMN IF NOT EXISTS operator_insurance_monthly numeric(10, 2),
  ADD COLUMN IF NOT EXISTS insurance_markup_multiplier numeric(4, 2) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS suggested_weekly_rate numeric(10, 2),
  ADD COLUMN IF NOT EXISTS suggested_daily_rate numeric(10, 2);

COMMENT ON COLUMN public.fleet.operator_insurance_monthly IS
  'What TMMT pays per month to insure this unit; renter charge uses insurance_markup_multiplier (default 2×).';
COMMENT ON COLUMN public.fleet.insurance_markup_multiplier IS
  'Multiplier on operator_insurance_monthly for renter insurance (minimum 2).';
COMMENT ON COLUMN public.fleet.suggested_weekly_rate IS
  'System-suggested let-go weekly rate from value + insurance (optional cache).';
COMMENT ON COLUMN public.fleet.suggested_daily_rate IS
  'System-suggested daily rate derived from suggested weekly.';
