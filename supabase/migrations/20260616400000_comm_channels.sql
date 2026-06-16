-- Communication Channel Topology — wire every number to its job + policy.
-- Doc: docs/CHANNEL-TOPOLOGY.md
--
-- GHL  -> campaigns / ads / leads (inbound marketing)
-- Quo  -> customer satisfaction + support + internal vendor contact
-- Work cell (571-326-5611) -> owner's working-hours line, bridged to Mac M1
--   (top-tier assistant); receives escalations.
-- Personal (571-351-9690) -> DO NOT CONTACT — ideally gets nothing.

CREATE TABLE IF NOT EXISTS public.comm_channels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id        uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  label         text NOT NULL,
  provider      text NOT NULL CHECK (provider IN ('ghl', 'quo', 'work_cell', 'personal', 'other')),
  phone         text,                       -- E.164 normalized
  purpose       text,                       -- 'campaigns_ads_leads' | 'customer_support' | 'vendor_internal' | 'owner_assistant' | 'owner_personal'
  direction     text NOT NULL DEFAULT 'both' CHECK (direction IN ('inbound', 'outbound', 'both')),
  policy        text NOT NULL DEFAULT 'normal' CHECK (policy IN ('normal', 'do_not_contact', 'escalation_only')),
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {tz, days:[1..7 Mon=1], start:'08:00', end:'20:00'}
  priority      int NOT NULL DEFAULT 0,      -- assistant ranking (higher = more preferred)
  active        boolean NOT NULL DEFAULT true,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone)
);
CREATE INDEX IF NOT EXISTS comm_channels_purpose_idx ON public.comm_channels (purpose);
CREATE INDEX IF NOT EXISTS comm_channels_policy_idx ON public.comm_channels (policy);

ALTER TABLE public.comm_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_comm_channels" ON public.comm_channels
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

CREATE OR REPLACE FUNCTION public.touch_comm_channels_updated_at ()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_comm_channels_updated_at ON public.comm_channels;
CREATE TRIGGER trg_comm_channels_updated_at
  BEFORE UPDATE ON public.comm_channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_comm_channels_updated_at ();

-- Seed the four channels (idempotent on phone; GHL number filled in later).
INSERT INTO public.comm_channels (org_id, label, provider, phone, purpose, direction, policy, working_hours, priority)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GHL Campaigns / Ads / Leads', 'ghl', NULL,
     'campaigns_ads_leads', 'both', 'normal', '{}'::jsonb, 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Quo Support + Vendor Internal', 'quo', '+15714508727',
     'customer_support', 'both', 'normal', '{}'::jsonb, 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner Work Cell (Mac M1 assistant)', 'work_cell', '+15713265611',
     'owner_assistant', 'both', 'escalation_only',
     '{"tz":"America/New_York","days":[1,2,3,4,5,6],"start":"08:00","end":"20:00"}'::jsonb, 100),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner Personal (DO NOT CONTACT)', 'personal', '+15713519690',
     'owner_personal', 'inbound', 'do_not_contact', '{}'::jsonb, 0)
ON CONFLICT (phone) DO NOTHING;

COMMENT ON TABLE public.comm_channels IS 'Channel topology: each number/provider, its purpose, and routing policy (normal | escalation_only | do_not_contact). The personal line is do_not_contact.';
