-- Supervisor/owner sign-off for discounts above 20%

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS supervisor_discount_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS supervisor_discount_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_approval_tier text;

COMMENT ON COLUMN public.bookings.discount_approval_tier IS
  'none | manager | supervisor — who had to approve the quoted discount.';
