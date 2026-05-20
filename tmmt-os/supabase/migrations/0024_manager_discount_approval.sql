-- Manager sign-off for discounts above staff threshold

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS manager_discount_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_discount_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_manager_discount_approval boolean DEFAULT false;

COMMENT ON COLUMN public.bookings.requires_manager_discount_approval IS
  'True when discount exceeded staff auto-approve threshold at quote time.';
