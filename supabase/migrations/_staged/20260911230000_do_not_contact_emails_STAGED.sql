-- =============================================================================
-- Do-not-contact, by email address (G7) — STAGED, NOT APPLIED.
--
-- Applying this is OWNER-GATED. Do not `supabase db push`.
--
-- The SMS lane has `do_not_contact_numbers`, keyed by the last ten digits of a
-- phone. Email has had no equivalent because nothing could send email. This is
-- the same idea for the email lane, and the email gate refuses to send when it
-- cannot read this table — so until the table exists, EVERY email is refused.
-- That is the intended order: the block list ships before the send path does.
--
-- `email_norm` is the lowercase, trimmed address, because "Bob@Example.COM " and
-- "bob@example.com" are one person and a case-sensitive block list is not a
-- block list. Normalisation lives in normalizeEmail() in src/lib/email/dnc.ts;
-- the CHECK here stops a row being written in any other shape.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.do_not_contact_emails (
  email_norm  text PRIMARY KEY
                CHECK (email_norm = lower(btrim(email_norm)) AND position('@' in email_norm) > 1),
  reason      text,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.do_not_contact_emails ENABLE ROW LEVEL SECURITY;

-- A suppression list is never public and never client-readable. Only the
-- service role touches it, which is how do_not_contact_numbers is handled too.
REVOKE ALL ON public.do_not_contact_emails FROM anon;
REVOKE ALL ON public.do_not_contact_emails FROM authenticated;

COMMENT ON TABLE public.do_not_contact_emails IS
  'Email suppression list for the outbound email lane. Keyed by lowercase trimmed address. Service-role only. The email gate fails CLOSED when this cannot be read.';
