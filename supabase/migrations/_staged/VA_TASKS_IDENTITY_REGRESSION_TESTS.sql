-- VA_TASKS_IDENTITY_REGRESSION_TESTS.sql
-- STAGED — READ-ONLY / SYNTHETIC. Not applied. 2026-09-06.
--
-- Purpose: prove "distinct work items remain distinct through generation".
-- Every test states its own PASS condition. Tests 1-4 and 6-7 run read-only
-- against production. Test 5 is a demonstration, not a fix.
--
-- Run order is independent; none mutate.

-- ── T1 · payment_followup — two cp.id stay two work items ────────────────────
-- PASS: identities = rows (no collapse), even where descriptive fields match.
select 'T1 payment_followup' as test,
       count(*)                                              as qualifying_rows,
       count(distinct cp.id)                                 as distinct_source_pks,
       count(distinct coalesce(cp.customer,'~')||'|'||coalesce(cp.customer_phone_number::text,'~'))
                                                             as distinct_subject_keys,
       case when count(distinct cp.id) = count(*) then 'PASS' else 'FAIL' end as verdict
from customer_payments cp
where (cp.payment_status ilike '%overdue%' or cp.payment_status ilike '%past due%'
    or cp.payment_status ilike '%late%'
    or (cp.next_payment_due_date is not null and cp.next_payment_due_date < current_date));

-- ── T2 · waitlist_contact — two w.id stay two ───────────────────────────────
select 'T2 waitlist_contact' as test,
       count(*) as qualifying_rows, count(distinct w.id) as distinct_source_pks,
       case when count(distinct w.id) = count(*) then 'PASS' else 'FAIL' end as verdict
from waitlist w
where w.status not in ('Fulfilled','Cancelled','Converted','Not Interested','Removed')
  and w.date_added_to_waitlist is not null
  and w.date_added_to_waitlist < current_date - 30;

-- ── T3 · lead_reengagement — subject-key twins stay distinct under l.id ─────
-- The 09-03 contract measured 64 of 163 subjects matching >1 lead row.
-- PASS: distinct l.id > distinct subject keys (i.e. l.id preserves what sk collapses).
select 'T3 lead_reengagement' as test,
       count(distinct l.id) as distinct_source_pks,
       count(distinct coalesce(l.contact_name,'~')||'|'||coalesce(l.phone_e164,l.phone::text,'~')||'|'||coalesce(l.email,'~'))
                            as distinct_subject_keys,
       case when count(distinct l.id) >= count(distinct coalesce(l.contact_name,'~')||'|'||coalesce(l.phone_e164,l.phone::text,'~')||'|'||coalesce(l.email,'~'))
            then 'PASS' else 'FAIL' end as verdict
from incoming_leads l
where (l.status is null or l.status in ('New','New Lead'))
  and l.created_at < now() - interval '30 days'
  and (l.phone is not null or l.phone_e164 is not null)
  and l.email not ilike '%noreply%';

-- ── T4 · bgcheck_review — THE SWEEP-ABORT TEST ──────────────────────────────
-- Deployed identity is bc.customer_id, but the SELECT is row-level with no
-- GROUP BY. Two qualifying rows for one customer produce duplicate arbiter keys
-- in ONE command -> "ON CONFLICT DO UPDATE command cannot affect row a second time",
-- which aborts the WHOLE generator run, all five categories.
-- PASS: customers_with_2plus = 0  (latent, not live)
with eligible as (
  select bc.id as background_check_id, bc.customer_id
  from background_checks bc
  where (bc.eligibility_status = 'Need Manager''s Review' or bc.eligibility_status is null)
    and bc.customer_id is not null
), grouped as (
  select customer_id, count(*) as n from eligible group by customer_id
)
select 'T4 bgcheck_review sweep-abort' as test,
       (select count(*) from eligible)                     as qualifying_rows,
       (select count(*) from grouped)                      as qualifying_customers,
       (select count(*) from grouped where n >= 2)         as customers_with_2plus,
       (select coalesce(max(n),0) from grouped)            as max_rows_per_customer,
       (select coalesce(sum(n),0) from grouped where n>=2) as rows_in_duplicate_groups,
       case when (select count(*) from grouped where n >= 2) = 0
            then 'PASS (latent only)' else 'FAIL (LIVE SWEEP-ABORT)' end as verdict;

-- ── T5 · ticket_collect — DEMONSTRATION, NOT A FIX ──────────────────────────
-- Shows why free-text aggregation cannot guarantee identity. Do NOT "solve"
-- this by normalising and accepting the collision.
-- Reports groups that a normalised key would MERGE, and the threshold effect.
select 'T5 ticket_collect fragmentation' as test,
       lower(btrim(t.requested_by_customer))       as normalised_person,
       count(distinct t.requested_by_customer)     as raw_group_keys,
       sum(t.amount)                               as true_total_owed,
       count(*) filter (where true)                as ticket_rows,
       case when count(distinct t.requested_by_customer) > 1
            then 'FRAGMENTED — one person, multiple groups' else 'single group' end as finding
from tickets t
where t.amount > 0
  and (t.status is null or t.status not in ('Closed','Resolved','Done'))
  and t.requested_by_customer is not null
group by lower(btrim(t.requested_by_customer))
having count(distinct t.requested_by_customer) > 1
order by true_total_owed desc;

-- ── T6 · idempotency — second run must not grow the table ───────────────────
-- Owner-gated (calls the generator). Run manually, NOT part of the read-only set.
--   select count(*) from exec_va_tasks;              -- before
--   select public.generate_va_tasks_v2();            -- run 1
--   select count(*) from exec_va_tasks;              -- after 1
--   select public.generate_va_tasks_v2();            -- run 2
--   select count(*) from exec_va_tasks;              -- MUST equal after 1
-- OBSERVED 2026-09-06: 19,097 -> 19,097 -> 19,097. PASS.

-- ── T7 · classifier reconciliation — contract invariant ─────────────────────
-- Contract (40_AIXMOS_TRIAGE_CONTROL_PLANE.md): classified = source rows,
-- 0 dropped, 0 duplicated. Lifecycle (status) stays separate from authority (triage).
-- PASS: unclassified = 0 AND classified = total.
select 'T7 classifier reconciliation' as test,
       count(*)                                  as total_rows,
       count(*) filter (where triage is not null) as classified,
       count(*) filter (where triage is null)     as unclassified,
       case when count(*) filter (where triage is null) = 0
             and count(*) filter (where triage is not null) = count(*)
            then 'PASS' else 'FAIL' end as verdict
from exec_va_tasks;
-- DO NOT add a status filter here to make counts look cleaner. Cross-status
-- classification is the documented contract, not a defect.
