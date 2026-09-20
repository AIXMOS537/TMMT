-- =============================================================================
-- Consent record for outbound contact (G8) — STAGED, NOT APPLIED. Owner-gated.
--
-- WHY THIS EXISTS: there is no column anywhere in this schema that records
-- "this person agreed to be contacted, on this date, through this form". The
-- only consent columns live on program_applications, which is the cross-company
-- handoff, not the contact path. So we cannot produce consent for a number if a
-- carrier or a regulator asks for it.
--
-- THE NUMBER THAT MATTERS, measured 2026-09-11 against the live table:
--   883 leads total
--   610 source = 'unknown'   (69%)
--   139 source = 'ads'
--    63 source = 'form' or 'ghl_form'   <- the only ones with any consent trail
-- About SEVEN PERCENT of the book can be shown to have come through a form we
-- control. This migration does not fix that. It makes it visible and stops it
-- getting worse, which is the honest first step.
--
-- DELIBERATELY NOT BACKFILLING. It would be trivial to write
--   update incoming_leads set consent_source = 'form' where source = 'form'
-- and that is exactly the wrong move: it would manufacture a consent record for
-- 63 people based on a guess about what a form said at the time, and a
-- manufactured consent record is worse than an absent one. Absent is honest.
-- Any backfill must be evidenced from the actual form submissions.
-- =============================================================================

ALTER TABLE public.incoming_leads
  -- How consent was captured. NULL means "we do not know", which is the truth
  -- for most of this table and must stay distinguishable from "no consent".
  ADD COLUMN IF NOT EXISTS consent_source text
    CHECK (consent_source IS NULL OR consent_source IN (
      'web_form',        -- submitted a form on a site we control
      'sms_double_optin',-- replied YES/START to a confirmation text
      'verbal_recorded', -- said yes on a recorded call
      'written',         -- signed paperwork
      'imported_claimed' -- a partner asserted it; weakest, and labelled as such
    )),
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  -- Free text for the evidence trail: form id, recording id, document ref.
  ADD COLUMN IF NOT EXISTS consent_evidence text;

-- Finding a lead with no consent trail is the common query once this is live.
CREATE INDEX IF NOT EXISTS incoming_leads_no_consent
  ON public.incoming_leads (organization_id)
  WHERE consent_source IS NULL;

COMMENT ON COLUMN public.incoming_leads.consent_source IS
  'How permission to contact was captured. NULL = unknown, which is NOT the same as consented. Never backfill from a guess.';
