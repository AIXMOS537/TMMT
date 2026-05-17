-- Portfolio command center: ventures registry (Phase 0)
-- Requires public.is_staff() from 20260503120000_partner_portal_rls.sql

CREATE TABLE IF NOT EXISTS public.ventures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  color text,
  logo_url text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived')),
  pinned_widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ventures (slug, name, description, color, status)
VALUES (
  'tmmt-rentals',
  'TMMT Rentals',
  'Vehicle rental operations (fleet, leads, customers, tickets)',
  '#2563eb',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_all_ventures" ON public.ventures;
CREATE POLICY "staff_all_ventures" ON public.ventures
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

COMMENT ON TABLE public.ventures IS
  'Portfolio businesses hosted in the command center; TMMT Rentals is venture #1.';
