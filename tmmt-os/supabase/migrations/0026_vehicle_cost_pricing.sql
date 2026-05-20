-- Vehicle cost-basis pricing (value + operator insurance × markup)

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS acquisition_cost numeric(12, 2),
  ADD COLUMN IF NOT EXISTS list_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS operator_insurance_monthly numeric(10, 2),
  ADD COLUMN IF NOT EXISTS insurance_markup_multiplier numeric(4, 2) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS suggested_weekly_rate numeric(10, 2),
  ADD COLUMN IF NOT EXISTS suggested_daily_rate numeric(10, 2),
  ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'cost_basis';

COMMENT ON COLUMN public.vehicles.pricing_mode IS 'cost_basis | matrix | manual';
