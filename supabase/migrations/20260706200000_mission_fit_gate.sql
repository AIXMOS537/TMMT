-- Mission fit gate — no one enters without passing (operators + returning team)
-- Max 100 lifetime · launch cap 10 active

ALTER TABLE public.team_onboarding
  ADD COLUMN IF NOT EXISTS applicant_type text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS fit_test_id uuid,
  ADD COLUMN IF NOT EXISTS fit_score int,
  ADD COLUMN IF NOT EXISTS fit_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fit_reviewed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.mission_fit_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  phone text,
  email text,
  applicant_type text NOT NULL DEFAULT 'new_operator'
    CHECK (applicant_type IN ('new_operator', 'returning_team', 'failed_operator', 'new_party')),
  team_onboarding_id uuid,
  answers jsonb NOT NULL DEFAULT '{}',
  score int NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  auto_result text,
  executive_review_required boolean NOT NULL DEFAULT false
);

ALTER TABLE public.mission_fit_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_mission_fit" ON public.mission_fit_tests;
CREATE POLICY "anon_insert_mission_fit"
  ON public.mission_fit_tests FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "staff_all_mission_fit" ON public.mission_fit_tests;
CREATE POLICY "staff_all_mission_fit"
  ON public.mission_fit_tests FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_mission_fit_phone ON public.mission_fit_tests (phone);
CREATE INDEX IF NOT EXISTS idx_mission_fit_passed ON public.mission_fit_tests (passed, created_at DESC);
