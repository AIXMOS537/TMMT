-- Quo Support Line → Brain → Dispatch — Phase 3a/3b
-- Spec: docs/superpowers/specs/2026-06-16-quo-support-dispatch-design.md
--
-- Adds the opted-in SERVICE/ENTITLEMENT model (the gap surfaced by recon) so an
-- inbound Quo support contact can be matched to the service the client selected
-- at initial setup before any routing happens. Also adds cases.agent_draft for
-- the evaluate/plan step.

-- ---------------------------------------------------------------------------
-- 1. customer_services — what each client opted into at setup
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id        uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  entity_id     uuid REFERENCES public.memory_entities (id) ON DELETE SET NULL,
  customer_name text,
  -- normalized digits (strip non-digits) so inbound caller-id matches reliably
  contact_phone text,
  contact_email text,
  service_slug  text NOT NULL,                 -- 'roadside', 'detailing', 'rental_support', ...
  service_name  text,
  tier          text,                          -- maps to offer tiers if relevant
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'trial', 'paused', 'cancelled')),
  channel       text,                          -- how they opted in (setup form, etc.)
  opted_in_at   timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_services_phone_idx ON public.customer_services (contact_phone);
CREATE INDEX IF NOT EXISTS customer_services_email_idx ON public.customer_services (contact_email);
CREATE INDEX IF NOT EXISTS customer_services_org_idx ON public.customer_services (org_id);
CREATE INDEX IF NOT EXISTS customer_services_entity_idx ON public.customer_services (entity_id);

ALTER TABLE public.customer_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_customer_services" ON public.customer_services
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

CREATE OR REPLACE FUNCTION public.touch_customer_services_updated_at ()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_services_updated_at ON public.customer_services;
CREATE TRIGGER trg_customer_services_updated_at
  BEFORE UPDATE ON public.customer_services
  FOR EACH ROW EXECUTE FUNCTION public.touch_customer_services_updated_at ();

COMMENT ON TABLE public.customer_services IS 'Quo Support: services a client opted into at setup; gates support routing. contact_phone is normalized digits.';

-- ---------------------------------------------------------------------------
-- 2. cases.agent_draft — evaluate/plan output from runAgentOnCase
-- ---------------------------------------------------------------------------
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS agent_draft jsonb;
