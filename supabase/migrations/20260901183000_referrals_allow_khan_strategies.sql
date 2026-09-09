-- Let referrals reach Khan Strategies.
--
-- Applied to uapxakmlwnpfsftfeezx. partner_referrals carries everything a
-- referral needs — consent timestamp and channel, commission, the
-- accepted/completed/paid lifecycle — and enforce_handoff_consent() already
-- blocks an acceptance that has no logged consent. It had never held a row, and
-- this was why: both org columns were constrained to 'tmmt' and 'aixmos', so a
-- referral to anyone outside those two could not be written at all.
--
-- Khan Strategies LLC is an existing organization (370cd891-…) that runs its own
-- business and its own cars, and customers move in both directions. So it is
-- added to BOTH source_org and dest_org: they refer to us as well.
--
-- Deliberately not added: moe_legacy. It was never in this constraint, and per
-- docs/UMAR-MOE-TERMINAL-NOTICE.md it must not be — no lane, under any framing.

alter table public.partner_referrals
  drop constraint if exists partner_referrals_source_org_check;
alter table public.partner_referrals
  add constraint partner_referrals_source_org_check
  check (source_org = any (array['tmmt'::text, 'aixmos'::text, 'khan_strategies'::text]));

alter table public.partner_referrals
  drop constraint if exists partner_referrals_dest_org_check;
alter table public.partner_referrals
  add constraint partner_referrals_dest_org_check
  check (dest_org = any (array['tmmt'::text, 'aixmos'::text, 'khan_strategies'::text]));
