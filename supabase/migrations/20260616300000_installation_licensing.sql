-- Installation Licensing & Backend Lock — gate backend access behind the full
-- $50k installation (paid + setup + comprehension + activation), hardware-bound.
-- Spec: docs/SECURITY-LICENSING.md
--
-- This is the ENFORCEABLE runtime gate. True source secrecy ("can't see how it
-- was built") is a deployment posture (host server-side / ship no source /
-- disk-encrypt) documented in the spec — a DB lock cannot read minds, but it can
-- refuse to run the app until a license is active.

CREATE TABLE IF NOT EXISTS public.installations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id                 uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  hardware_uuid          text,                       -- binds the license to one device
  tier                   text NOT NULL DEFAULT 'full_install_50k',
  status                 text NOT NULL DEFAULT 'locked'
                           CHECK (status IN ('locked','provisioning','setup','comprehension','active','suspended','revoked')),
  paid_at                timestamptz,
  setup_completed_at     timestamptz,
  comprehension_passed_at timestamptz,
  activated_at           timestamptz,
  license_key            text UNIQUE,
  notes                  text,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, hardware_uuid)
);
CREATE INDEX IF NOT EXISTS installations_org_idx ON public.installations (org_id);
CREATE INDEX IF NOT EXISTS installations_hw_idx ON public.installations (hardware_uuid);

ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;

-- Only provider staff (is_staff) may read/manage licenses; service role bypasses
-- for provisioning. Client-org users CANNOT see license internals.
CREATE POLICY "staff_all_installations" ON public.installations
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

CREATE OR REPLACE FUNCTION public.touch_installations_updated_at ()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_installations_updated_at ON public.installations;
CREATE TRIGGER trg_installations_updated_at
  BEFORE UPDATE ON public.installations
  FOR EACH ROW EXECUTE FUNCTION public.touch_installations_updated_at ();

-- Gate function: is the backend unlocked for this user?
--   - Provider/owner (profiles.role = 'admin') ALWAYS unlocked (never lock the builder out).
--   - Everyone else: their org must have a fully-activated installation.
-- SECURITY DEFINER so middleware can call it regardless of the caller's RLS.
CREATE OR REPLACE FUNCTION public.backend_unlocked_for (p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT CASE
    WHEN (SELECT role FROM public.profiles WHERE id = p_user) = 'admin' THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.installations i
      JOIN public.profiles p ON p.organization_id = i.org_id
      WHERE p.id = p_user
        AND i.status = 'active'
        AND i.paid_at IS NOT NULL
        AND i.setup_completed_at IS NOT NULL
        AND i.comprehension_passed_at IS NOT NULL
    )
  END;
$$;

COMMENT ON TABLE public.installations IS 'Backend lock: per-org, hardware-bound $50k installation license. Backend stays locked until paid + setup + comprehension + active.';
COMMENT ON FUNCTION public.backend_unlocked_for(uuid) IS 'Owner(admin) bypass; else org must have a fully-activated installation. Used by middleware gate (BACKEND_LOCK_ENABLED).';
