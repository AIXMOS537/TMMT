-- ═══════════════════════════════════════════════════════════════════════════════════
-- OWNER-RUN SCRIPT — every pending production change, 2026-09-16
--
-- The owner approved all of this. The writes were blocked by the Claude Code safety
-- classifier, which is a harness guard and not something chat approval lifts, so this
-- file exists to be run by the owner (Supabase SQL editor or psql) in ONE paste.
--
-- Every statement below has been rehearsed on the throwaway project
-- xcjuohpmtdywgzdxkssb. Evidence: evidence/client-self-service-rehearsal.md and
-- evidence/financing-applications-rehearsal.md.
--
-- ROLLBACK: docs/repairs/20260916-bg_check_queue.rollback.sql (verbatim pre-change
-- definition, read from production before anything was attempted), plus
--   drop function if exists public.customer_payments_queue(text, integer);
--   drop function if exists public.client_bg_status(uuid);
--   drop table if exists public.financing_applications;
--   alter table public.client_journey drop column if exists ownership_opt_in_at;
--
-- Run inside ONE transaction. If any section errors, nothing lands.
-- ═══════════════════════════════════════════════════════════════════════════════════

begin;

-- ── SECTION 1 ─────────────────────────────────────────────────────────────────────
-- Closes a LIVE leak. is_staff() carries no org predicate, so any staff account today
-- reads every tenant's 299 background checks. Also adds the first masked read path for
-- customer_payments, and the renter self-service RPC.
-- NO RLS POLICY IS TOUCHED. The 2026-08-25 admin-only hardening stays exactly as it is.
\i supabase/migrations/20260916230000_client_and_org_scoped_sensitive_access.sql

-- ── SECTION 2 ─────────────────────────────────────────────────────────────────────
-- The Drive-to-Own opt-in, and the record of a lender's decision.
\i supabase/migrations/20260917000000_financing_applications_and_ownership_optin.sql

-- ── SECTION 2b ────────────────────────────────────────────────────────────────────
-- Makes the FIRST gate of the ladder clearable. credit_education_acknowledgments.profile_id
-- is NOT NULL, and 0 of 35 journeys carry a profile_id because renters have no accounts, so
-- gate 10 is currently unevidencable for every renter alive. Adds a nullable journey_id,
-- drops the NOT NULL, and adds a CHECK requiring at least one subject -- strictly no weaker.
\i supabase/migrations/20260917010000_education_ack_by_journey.sql

-- ── SECTION 3 — RATE CARD CORRECTIONS ─────────────────────────────────────────────
-- These REMOVE WRONG DATA. They do not set new prices — deciding what to charge is the
-- owner's call and is deliberately left alone. See the note at the end.
--
-- 3a. Retire the five make/model rules that match ZERO vehicles in `fleet`. The card
--     prices a luxury business (S-Class $1,600/wk, 7 Series $1,550) against a real fleet
--     that runs $300-$550/wk. These can only mislead.
update public.rental_pricing_rules set active = false
 where make is not null
   and (make, coalesce(model,'')) in (
       ('Mercedes-Benz','S-Class'), ('BMW','7 Series'), ('Porsche',''),
       ('Mercedes-Benz','C-Class'), ('BMW','3 Series'));

-- 3b. The generic economy fallback sits BELOW the cheapest real car ($300/wk), so an
--     unpriced car would quote under the floor. Raise it to the real minimum. This is a
--     correction to a demonstrably wrong figure, not a pricing decision.
update public.rental_pricing_rules
   set weekly_rate_cents = 30000, daily_rate_cents = 5500
 where tier = 'economy' and make is null and weekly_rate_cents < 30000;

-- ── SECTION 4 — QUARANTINE THE E2E TEST LEADS ─────────────────────────────────────
-- Two "Test User" rows entered the live lead book from the end-to-end run. They are
-- SUPPRESSED rather than DELETED: suppression is reversible and achieves the actual goal
-- (never contacted). Deleting real rows is the one thing worth not doing casually.
update public.incoming_leads
   set opted_out = true
 where contact_name = 'Test User'
   and phone::text like '%[phone removed]%'
   and created_at > '2026-09-16'::date;

commit;

-- ═══════════════════════════════════════════════════════════════════════════════════
-- VERIFY AFTER RUNNING (all four should read as described)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname in
--        ('bg_check_queue','customer_payments_queue','client_bg_status');        -- 3
-- select count(*) from public.financing_applications;                            -- 0
-- select count(*) from information_schema.columns
--  where table_name='client_journey' and column_name='ownership_opt_in_at';      -- 1
-- select count(*) from public.rental_pricing_rules where active;                 -- 5
-- select count(*) from public.incoming_leads
--  where contact_name='Test User' and opted_out;                                 -- 2
-- select is_nullable from information_schema.columns
--  where table_name='credit_education_acknowledgments' and column_name='profile_id'; -- YES
--
-- ═══════════════════════════════════════════════════════════════════════════════════
-- STILL THE OWNER'S CALL — deliberately NOT in this script
-- ═══════════════════════════════════════════════════════════════════════════════════
-- The Tesla Model 3 rule quotes $550/wk against a real posted price of $450. That is a
-- $100 gap on the one car the card correctly matches. I have not changed it, because
-- unlike 3a and 3b it is not obviously wrong data — it may be the rate you intend to
-- charge. The engine prefers the car's own posted price anyway, so the card is only a
-- fallback. Decide the number and it is one line:
--   update public.rental_pricing_rules set weekly_rate_cents = 45000
--    where tier='economy' and make='Tesla' and model='Model 3';
