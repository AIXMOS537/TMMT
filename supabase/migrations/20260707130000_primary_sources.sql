-- Add primary report sources: disputefox, myfreescorenow
-- Apply to: uapxakmlwnpfsftfeezx

ALTER TYPE report_source ADD VALUE IF NOT EXISTS 'disputefox';
ALTER TYPE report_source ADD VALUE IF NOT EXISTS 'myfreescorenow';

-- Primary source tracking on credit_profiles
ALTER TABLE credit_profiles
  ADD COLUMN IF NOT EXISTS disputefox_client_id text,
  ADD COLUMN IF NOT EXISTS mfsn_member_id text,
  ADD COLUMN IF NOT EXISTS mfsn_affiliate_ref text,
  ADD COLUMN IF NOT EXISTS mfsn_active boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_credit_profiles_disputefox
  ON credit_profiles(disputefox_client_id) WHERE disputefox_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_profiles_mfsn
  ON credit_profiles(mfsn_member_id) WHERE mfsn_member_id IS NOT NULL;
