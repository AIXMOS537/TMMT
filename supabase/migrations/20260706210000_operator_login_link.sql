-- Operator credential delivery: store the generated magic link on the
-- onboarding row so admins (or the SMS path) can actually deliver it.
-- generateLink() creates but never sends — without this, provisioned
-- operators had no way to log in.

ALTER TABLE public.team_onboarding
  ADD COLUMN IF NOT EXISTS login_link text,
  ADD COLUMN IF NOT EXISTS login_link_sent_at timestamptz;
