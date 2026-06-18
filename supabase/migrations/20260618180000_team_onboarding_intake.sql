-- Public team onboarding intake (the "easy as 1-2-3" link at /join).
-- Mirrors the incoming_leads public-form pattern: anon can INSERT only; staff read/manage.
-- Idempotent: safe to replay onto an environment where it is already applied.
CREATE TABLE IF NOT EXISTS public.team_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'operator',
  phone text,
  email text,
  owns text,
  skills text,
  first_step text,
  mission_accepted boolean NOT NULL DEFAULT false,
  confidentiality_agreed boolean NOT NULL DEFAULT false,
  device text,
  source text,
  status text NOT NULL DEFAULT 'Pending Review'
);

ALTER TABLE public.team_onboarding ENABLE ROW LEVEL SECURITY;

-- Anyone with the public link can submit (insert only). No anon SELECT.
DROP POLICY IF EXISTS "anon_insert_team_onboarding" ON public.team_onboarding;
CREATE POLICY "anon_insert_team_onboarding"
  ON public.team_onboarding FOR INSERT TO anon WITH CHECK (true);

-- Staff (owner/team) can read and manage every submission.
DROP POLICY IF EXISTS "staff_all_team_onboarding" ON public.team_onboarding;
CREATE POLICY "staff_all_team_onboarding"
  ON public.team_onboarding FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_team_onboarding_created_at
  ON public.team_onboarding (created_at DESC);
