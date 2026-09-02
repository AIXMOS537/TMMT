-- Record who sent someone to the credit intake.
--
-- Applied to uapxakmlwnpfsftfeezx. Salvaged from the moe-legacy project
-- (renmvevnrjptjeqwrdtr), which turned out to hold exactly one table and no
-- data — a one-day scaffold from 2026-06-26. The single idea in it worth
-- keeping was an affiliate_ref on the intake, and this table, which is far more
-- developed in every other respect, had no way to record a referral source at
-- all.
--
-- It matters now because referrals run both ways with Khan Strategies: they
-- send people to us as well. Without this an inbound referral arrives
-- anonymous and nobody can be credited for it.

alter table public.credit_funding_sessions
  add column if not exists affiliate_ref text;

create index if not exists credit_funding_sessions_affiliate_ref_idx
  on public.credit_funding_sessions (affiliate_ref)
  where affiliate_ref is not null;
