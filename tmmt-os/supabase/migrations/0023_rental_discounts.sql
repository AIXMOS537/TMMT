-- Booking / quote discount tracking for close-at-margin workflow

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS list_weekly_cents integer,
  ADD COLUMN IF NOT EXISTS quoted_weekly_cents integer,
  ADD COLUMN IF NOT EXISTS discount_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5, 2),
  ADD COLUMN IF NOT EXISTS vehicle_margin_percent numeric(5, 2),
  ADD COLUMN IF NOT EXISTS discount_status text,
  ADD COLUMN IF NOT EXISTS referred_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS min_margin_percent numeric(5, 2) DEFAULT 8.0;

COMMENT ON COLUMN public.bookings.discount_status IS 'approved | marginal | rejected';
COMMENT ON COLUMN public.bookings.referred_vehicle_id IS 'Set when original unit could not close and client referred elsewhere';
