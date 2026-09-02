-- AIX Credit Dispute Engine — full schema
-- Integrates with TMMT-LIVE client_journey + AIXMOS organization
-- Apply to: uapxakmlwnpfsftfeezx

-- ─── Enums ───────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE credit_bureau AS ENUM ('experian', 'equifax', 'transunion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tradeline_status AS ENUM (
    'open', 'closed', 'charged_off', 'collection', 'late', 'current', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE negative_item_type AS ENUM (
    'collection', 'charge_off', 'late_payment', 'bankruptcy',
    'foreclosure', 'repossession', 'tax_lien', 'judgment',
    'hard_inquiry', 'medical_debt', 'student_loan', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_round_type AS ENUM (
    'initial_611',           -- FCRA §611(a)(1)(A) — verification demand
    'method_of_verification', -- FCRA §611(a)(6)(B)(iii) — MOV demand
    'factual_confrontation',  -- Specific inaccuracies with evidence
    'furnisher_623',          -- FCRA §623(a)(8) — direct to furnisher
    'fdcpa_validation',       -- FDCPA §809 — collection validation
    'cfpb_escalation',        -- CFPB complaint template
    'intent_to_litigate'      -- FCRA §616/617 notice (accurate items only)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM (
    'draft', 'sent', 'awaiting_response', 'response_received',
    'removed', 'verified', 'updated', 'escalated', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_source AS ENUM (
    'smartcredit', 'manual_entry', 'screen_capture', 'annualcreditreport', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Client credit profiles ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_journey_id uuid,
  organization_id uuid,
  party_id uuid,
  -- PII (encrypted at app layer; store minimal)
  full_name text NOT NULL,
  date_of_birth date,
  ssn_last4 text,
  current_address jsonb NOT NULL DEFAULT '{}',
  previous_addresses jsonb NOT NULL DEFAULT '[]',
  phone text,
  email text,
  -- Smart Credit bridge
  smartcredit_member_id text,
  smartcredit_active boolean DEFAULT false,
  last_report_pull_at timestamptz,
  -- Scores
  score_experian int,
  score_equifax int,
  score_transunion int,
  score_updated_at timestamptz,
  -- Funding readiness
  funding_ready boolean DEFAULT false,
  funding_ready_at timestamptz,
  funding_notes text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_profiles_journey ON credit_profiles(client_journey_id);
CREATE INDEX IF NOT EXISTS idx_credit_profiles_org ON credit_profiles(organization_id);

-- ─── Credit reports (3-bureau pulls) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  source report_source NOT NULL DEFAULT 'manual_entry',
  pull_date date NOT NULL DEFAULT CURRENT_DATE,
  bureau credit_bureau,  -- null = tri-merge
  raw_data jsonb,
  screen_capture_url text,
  import_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_reports_profile ON credit_reports(credit_profile_id);

-- ─── Tradelines (accounts on report) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS tradelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_report_id uuid NOT NULL REFERENCES credit_reports(id) ON DELETE CASCADE,
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  bureau credit_bureau NOT NULL,
  creditor_name text NOT NULL,
  account_number_masked text,
  account_type text,
  status tradeline_status NOT NULL DEFAULT 'unknown',
  balance_cents bigint,
  credit_limit_cents bigint,
  high_balance_cents bigint,
  payment_status text,
  date_opened date,
  date_closed date,
  date_of_first_delinquency date,
  last_reported date,
  months_reviewed int,
  payment_history text,  -- 24-char string e.g. "CCCCCCCCCCCCCCCCCCCCCCCC"
  is_negative boolean NOT NULL DEFAULT false,
  negative_reasons text[] DEFAULT '{}',
  dispute_eligible boolean NOT NULL DEFAULT true,
  dispute_strategy text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tradelines_profile ON tradelines(credit_profile_id);
CREATE INDEX IF NOT EXISTS idx_tradelines_negative ON tradelines(credit_profile_id) WHERE is_negative = true;

-- ─── Negative items (classified derogatories) ────────────────────────

CREATE TABLE IF NOT EXISTS negative_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  tradeline_id uuid REFERENCES tradelines(id) ON DELETE SET NULL,
  bureau credit_bureau NOT NULL,
  item_type negative_item_type NOT NULL,
  furnisher_name text NOT NULL,
  account_number_masked text,
  reported_balance_cents bigint,
  date_reported date,
  date_of_first_delinquency date,
  -- Classification
  is_inaccurate boolean,
  is_outdated boolean,
  is_unverifiable boolean,
  inaccuracy_details text,
  -- Dispute tracking
  current_round int NOT NULL DEFAULT 0,
  max_rounds int NOT NULL DEFAULT 6,
  status dispute_status NOT NULL DEFAULT 'draft',
  removed_at timestamptz,
  removed_bureau credit_bureau,
  -- Legal basis
  fcra_basis text[] DEFAULT '{}',
  fdcpa_basis text[] DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negative_items_profile ON negative_items(credit_profile_id);
CREATE INDEX IF NOT EXISTS idx_negative_items_active ON negative_items(credit_profile_id)
  WHERE status NOT IN ('removed', 'closed');

-- ─── Dispute rounds (each letter cycle) ──────────────────────────────

CREATE TABLE IF NOT EXISTS dispute_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negative_item_id uuid NOT NULL REFERENCES negative_items(id) ON DELETE CASCADE,
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  round_type dispute_round_type NOT NULL,
  bureau credit_bureau NOT NULL,
  status dispute_status NOT NULL DEFAULT 'draft',
  -- Letter
  letter_subject text,
  letter_body text NOT NULL,
  letter_recipient text NOT NULL,
  letter_address jsonb,
  -- Tracking
  sent_at timestamptz,
  sent_method text,  -- 'certified_mail', 'fax', 'online', 'email'
  tracking_number text,
  response_due_at timestamptz,
  response_received_at timestamptz,
  response_summary text,
  response_document_url text,
  -- Outcome
  outcome text,
  escalated_to uuid REFERENCES dispute_rounds(id),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(negative_item_id, round_number, bureau)
);

CREATE INDEX IF NOT EXISTS idx_dispute_rounds_item ON dispute_rounds(negative_item_id);
CREATE INDEX IF NOT EXISTS idx_dispute_rounds_pending ON dispute_rounds(status)
  WHERE status IN ('sent', 'awaiting_response');

-- ─── Dispute protocol runs (orchestration log) ────────────────────────

CREATE TABLE IF NOT EXISTS dispute_protocol_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  protocol_name text NOT NULL DEFAULT 'aggressive_fcra',
  status text NOT NULL DEFAULT 'running',
  items_total int NOT NULL DEFAULT 0,
  items_disputed int NOT NULL DEFAULT 0,
  items_removed int NOT NULL DEFAULT 0,
  current_phase text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- ─── Results tracking (the product) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  score_experian int,
  score_equifax int,
  score_transunion int,
  trigger_event text,
  notes text
);

CREATE TABLE IF NOT EXISTS removal_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  negative_item_id uuid REFERENCES negative_items(id) ON DELETE SET NULL,
  bureau credit_bureau NOT NULL,
  furnisher_name text NOT NULL,
  item_type negative_item_type,
  removed_at timestamptz NOT NULL DEFAULT now(),
  rounds_required int,
  final_round_type dispute_round_type,
  proof_screenshot_url text,
  client_consent_for_marketing boolean DEFAULT false
);

-- ─── CROA compliance ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS croa_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_profile_id uuid NOT NULL REFERENCES credit_profiles(id) ON DELETE CASCADE,
  contract_version text NOT NULL DEFAULT '1.0',
  services_description text NOT NULL,
  total_cost_cents bigint NOT NULL,
  monthly_fee_cents bigint,
  timeframe_months int,
  signed_at timestamptz,
  cancel_by timestamptz,  -- 3-day right to cancel
  cancelled_at timestamptz,
  self_help_disclosure_ack boolean DEFAULT false,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Updated_at triggers ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_profiles_updated ON credit_profiles;
CREATE TRIGGER trg_credit_profiles_updated
  BEFORE UPDATE ON credit_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_negative_items_updated ON negative_items;
CREATE TRIGGER trg_negative_items_updated
  BEFORE UPDATE ON negative_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_dispute_rounds_updated ON dispute_rounds;
CREATE TRIGGER trg_dispute_rounds_updated
  BEFORE UPDATE ON dispute_rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
