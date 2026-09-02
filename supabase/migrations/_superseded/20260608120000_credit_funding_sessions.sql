-- Phase 9 — Credit & Funding Intelligence Engine
-- Spec: CREDIT_FUNDING_OS.md
-- One row per discovery session. Anon insert via server action. Authenticated read only.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS credit_funding_sessions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz NOT NULL DEFAULT now(),

  -- Stage 1 — relationship building
  first_name                  text,
  preferred_channel           text CHECK (preferred_channel IN ('sms','email','in_app') OR preferred_channel IS NULL),
  goals_horizon               text,
  personal_vs_business_focus  text CHECK (personal_vs_business_focus IN ('personal','business','both') OR personal_vs_business_focus IS NULL),
  top_friction                text,

  -- Stage 2 — business discovery
  entity_type                 text CHECK (entity_type IN ('none','sole_prop','llc','s_corp','c_corp','partnership') OR entity_type IS NULL),
  years_in_business           int CHECK (years_in_business IS NULL OR years_in_business >= 0),
  revenue_range               text CHECK (revenue_range IN ('none','<50k','50k-250k','250k-1m','>1m') OR revenue_range IS NULL),
  team_size                   text CHECK (team_size IN ('just_me','2-5','6-20','20+') OR team_size IS NULL),
  industry                    text,

  -- Stage 3 — funding readiness
  funding_goal_type           text CHECK (funding_goal_type IN ('growth','equipment','working_capital','real_estate','refinance','other') OR funding_goal_type IS NULL),
  prior_funding_history       text CHECK (prior_funding_history IN ('none','applied_no_approval','approved_completed','currently_servicing') OR prior_funding_history IS NULL),
  time_horizon                text CHECK (time_horizon IN ('immediate','near','planning','exploring') OR time_horizon IS NULL),
  readiness_indicators        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Stage 4 — credit awareness (no PII, no hard credit score numbers)
  awareness_level             text CHECK (awareness_level IN ('unaware','vaguely_aware','monitors_regularly','actively_managing') OR awareness_level IS NULL),
  self_reported_score_range   text CHECK (self_reported_score_range IN ('<580','580-619','620-679','680-739','740+','unknown') OR self_reported_score_range IS NULL),
  existing_challenges         jsonb NOT NULL DEFAULT '[]'::jsonb,
  prior_education_or_program  text CHECK (prior_education_or_program IN ('none','generic_app','paid_program','professional_advisor') OR prior_education_or_program IS NULL),

  -- Stage 5 — business infrastructure
  banking_status              text CHECK (banking_status IN ('none','personal_only','separate_business_account','multiple_business_accounts') OR banking_status IS NULL),
  entity_standing             text CHECK (entity_standing IN ('not_registered','registered','registered_and_in_good_standing','unknown') OR entity_standing IS NULL),
  web_presence                text CHECK (web_presence IN ('none','social_only','landing_page','full_site') OR web_presence IS NULL),
  bookkeeping                 text CHECK (bookkeeping IN ('none','spreadsheets','accounting_software','bookkeeper','cpa') OR bookkeeping IS NULL),
  documentation               text CHECK (documentation IN ('none','partial','organized_last_12mo','organized_24mo+') OR documentation IS NULL),

  -- Stage 6 — readiness scoring (0–10 each, 0–60 total)
  score_business_foundation   int CHECK (score_business_foundation BETWEEN 0 AND 10) DEFAULT 0,
  score_banking_readiness     int CHECK (score_banking_readiness BETWEEN 0 AND 10) DEFAULT 0,
  score_financial_organization int CHECK (score_financial_organization BETWEEN 0 AND 10) DEFAULT 0,
  score_credit_awareness      int CHECK (score_credit_awareness BETWEEN 0 AND 10) DEFAULT 0,
  score_revenue_stability     int CHECK (score_revenue_stability BETWEEN 0 AND 10) DEFAULT 0,
  score_funding_readiness     int CHECK (score_funding_readiness BETWEEN 0 AND 10) DEFAULT 0,
  score_total                 int GENERATED ALWAYS AS (
    COALESCE(score_business_foundation,0) +
    COALESCE(score_banking_readiness,0) +
    COALESCE(score_financial_organization,0) +
    COALESCE(score_credit_awareness,0) +
    COALESCE(score_revenue_stability,0) +
    COALESCE(score_funding_readiness,0)
  ) STORED,

  recommended_actions         jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Compliance gates (CREDIT_FUNDING_OS.md §4.3)
  ai_disclaimer_shown              boolean NOT NULL DEFAULT false,
  credit_guidance_disclaimer_linked boolean NOT NULL DEFAULT false,
  no_outcome_promised              boolean NOT NULL DEFAULT true,
  banned_terms_check_passed        boolean NOT NULL DEFAULT true,

  -- Session meta
  session_id                  text,
  started_at                  timestamptz,
  completed_at                timestamptz,
  stage_reached               int CHECK (stage_reached BETWEEN 1 AND 6),
  channel                     text,
  operator_handoff_requested  boolean NOT NULL DEFAULT false,
  routing_tier                text CHECK (routing_tier IN ('education','guidance','pre_referral','introduction') OR routing_tier IS NULL)
);

CREATE INDEX IF NOT EXISTS credit_funding_sessions_created_at_idx ON credit_funding_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS credit_funding_sessions_score_total_idx ON credit_funding_sessions (score_total DESC);
CREATE INDEX IF NOT EXISTS credit_funding_sessions_routing_tier_idx ON credit_funding_sessions (routing_tier);
CREATE INDEX IF NOT EXISTS credit_funding_sessions_handoff_idx ON credit_funding_sessions (operator_handoff_requested) WHERE operator_handoff_requested = true;

-- RLS — anon may INSERT only; authenticated has full access.
ALTER TABLE credit_funding_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_credit_funding" ON credit_funding_sessions;
CREATE POLICY "anon_insert_credit_funding"
  ON credit_funding_sessions FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_credit_funding" ON credit_funding_sessions;
CREATE POLICY "auth_all_credit_funding"
  ON credit_funding_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Privilege hardening: REVOKE FROM PUBLIC (anon inherits PUBLIC).
-- Then GRANT only the minimum each role actually needs.
REVOKE ALL ON credit_funding_sessions FROM PUBLIC;
GRANT INSERT ON credit_funding_sessions TO anon;
GRANT ALL    ON credit_funding_sessions TO authenticated;
GRANT ALL    ON credit_funding_sessions TO service_role;
