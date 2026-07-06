-- TMMT v3 soft launch: operator academy + auto-provision columns
-- Student-operators learn → earn → churn without human staff in the loop.

-- ── Team onboarding provision tracking ──────────────────────────────────────
ALTER TABLE public.team_onboarding
  ADD COLUMN IF NOT EXISTS affiliate_code text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS provision_error text;

CREATE INDEX IF NOT EXISTS idx_team_onboarding_status
  ON public.team_onboarding (status, created_at DESC);

-- ── Operator profile extensions ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_certified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_code text,
  ADD COLUMN IF NOT EXISTS unlock_status text;

-- ── Operator training modules (TRAP journey) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.operator_training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track text NOT NULL CHECK (track IN ('trap', 'avatar', 'garage', 'drive')),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  objective text,
  content_md text,
  est_minutes int NOT NULL DEFAULT 15,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operator_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.operator_training_modules (id) ON DELETE CASCADE,
  percent_complete int NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, module_id)
);

ALTER TABLE public.operator_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_training_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operators_read_modules" ON public.operator_training_modules;
CREATE POLICY "operators_read_modules"
  ON public.operator_training_modules FOR SELECT TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "operators_own_progress" ON public.operator_training_progress;
CREATE POLICY "operators_own_progress"
  ON public.operator_training_progress FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "staff_all_modules" ON public.operator_training_modules;
CREATE POLICY "staff_all_modules"
  ON public.operator_training_modules FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── Operator 360 view ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_operator_360 AS
SELECT
  p.id AS profile_id,
  p.full_name AS operator_name,
  p.affiliate_code,
  p.is_certified,
  p.unlock_status,
  COALESCE(m.total, 0) AS modules_total,
  COALESCE(pr.done, 0) AS modules_completed,
  CASE
    WHEN COALESCE(m.total, 0) = 0 THEN 0
    ELSE ROUND(100.0 * COALESCE(pr.done, 0) / m.total)
  END AS program_pct_complete
FROM public.profiles p
LEFT JOIN (
  SELECT count(*)::int AS total FROM public.operator_training_modules WHERE active = true
) m ON true
LEFT JOIN (
  SELECT profile_id, count(*)::int AS done
  FROM public.operator_training_progress
  WHERE percent_complete >= 100
  GROUP BY profile_id
) pr ON pr.profile_id = p.id
WHERE p.affiliate_code IS NOT NULL;

-- ── Seed TRAP modules (idempotent) ──────────────────────────────────────────
INSERT INTO public.operator_training_modules (track, slug, title, objective, est_minutes, sort_order, content_md)
VALUES
  ('trap', 'welcome', 'Welcome to TMMT', 'Understand what Trap Money Moves Timeless is and why you are here.', 10, 1,
   'TMMT exists so everyday people can learn, earn, and grow — without being hustled, stalled, or robbed. You are a student-operator: you share links, the AI qualifies leads, you earn your split.'),
  ('trap', 'mission', 'The Mission', 'Accept the mission: help people, protect the family, leave it better.', 10, 2,
   'For the people, by the people. Faith-centered. Every lead is a person seeking a second chance — treat them with dignity.'),
  ('trap', 'integrity', 'Integrity & Rules', 'Know what you can and cannot promise.', 15, 3,
   'Never promise credit scores, approvals, or funding amounts. One clear CTA per message. Use owner-approved links only.'),
  ('avatar', 'identity', 'Your Operator Identity', 'Set up your name, lane, and affiliate code.', 15, 4,
   'You are an independent contractor on a split. Your affiliate code tracks every sale you source.'),
  ('avatar', 'brand', 'Your Brand Voice', 'Sound like a helper, not a salesperson.', 15, 5,
   'Warm, direct, one step at a time. Same voice as the AI agent — consistent and trustworthy.'),
  ('avatar', 'tools', 'Your Toolkit', 'Know your login, links, and daily checklist.', 20, 6,
   'Login: tmmt-command-center.vercel.app. Share links from tmmt-ops.vercel.app with ?ref=YOURCODE.'),
  ('avatar', 'dream-car', 'The Dream Car Path', 'How operators earn toward their own vehicle.', 15, 7,
   'Most racers start here to get access to a car — or their dream car — without predatory dealers. Credit gate → funding → rental/lease path.'),
  ('garage', 'vertical-pick', 'Pick Your Lane', 'Choose your industry vertical or use the network default.', 20, 8,
   'Dealership, rentals, credit/funding, e-commerce — or bring your own. The engine clones; you drive.'),
  ('garage', 'credit-gate', 'Credit Gate (Front Door)', 'Every customer path starts with credit guidance.', 20, 9,
   'Credit is the front door. Qualify → clean file → funding → rental. You funnel; the system handles intake.'),
  ('garage', 'funnel-basics', 'The Funnel', 'Lead → qualify → checkout → your commission.', 20, 10,
   'Share tracked links → lead hits AI SMS → GHL checkout → aff:YOURCODE on payment → 30% commission accrues.'),
  ('garage', 'compliance', 'Compliance & Opt-Out', 'STOP means stop. Quiet hours matter.', 15, 11,
   'Respect opt-outs. No spam. The system enforces quiet hours and CFPB disclaimers automatically.'),
  ('drive', 'share-links', 'Share Your First Link', 'Send one prospect link today.', 15, 12,
   'Start with /lp/aixmos/lead-magnet?ref=YOURCODE or /forms/lead-intake?ref=YOURCODE.'),
  ('drive', 'daily-rhythm', 'Daily Operator Rhythm', '2-minute daily checklist.', 10, 13,
   '1) Check /operator for instructions. 2) Send one link. 3) Log outreach. 4) Complete one training module.'),
  ('drive', 'earnings', 'How You Get Paid', 'Understand your split and payout rhythm.', 15, 14,
   '30% of collected sales attributed to your code. View live earnings at /operator/earnings. Paid monthly on collected revenue.'),
  ('drive', 'certification', 'Get Certified', 'Complete all modules to unlock full toolkit.', 10, 15,
   '100% modules = certified operator. Full toolkit unlocks. Keep learning, earning, churning toward your goals.')
ON CONFLICT (slug) DO NOTHING;
