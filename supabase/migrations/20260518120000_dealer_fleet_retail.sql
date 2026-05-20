-- Retail dealer fields on Command Center fleet (mom-and-pop inventory / deal desk)

ALTER TABLE public.fleet
  ADD COLUMN IF NOT EXISTS acquisition_cost numeric(12, 2),
  ADD COLUMN IF NOT EXISTS list_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS retail_status text;

COMMENT ON COLUMN public.fleet.acquisition_cost IS 'Dealer: all-in cost basis for gross per unit.';
COMMENT ON COLUMN public.fleet.list_price IS 'Dealer: asking / sticker price on lot.';
COMMENT ON COLUMN public.fleet.retail_status IS 'Dealer: available | pending | sold (retail lot; parallel to vehicle_status for rentals).';

CREATE INDEX IF NOT EXISTS fleet_retail_status_idx ON public.fleet (retail_status)
  WHERE retail_status IS NOT NULL;
