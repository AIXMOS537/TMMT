-- OWNER MEASUREMENT PACKET — 2026-09-06
-- READ-ONLY. Paste into the Supabase SQL Editor. Returns 5 result sets.
-- Statically audited: no INSERT/UPDATE/DELETE/DDL/GRANT/CALL/COPY, no function call.
-- Every gated measurement this repair still needs, combined into ONE owner action.

-- ═══ Q1 · bgcheck_review sweep-abort confirmation (was T4) ═══════════════════
-- Migration 20260906022113 line 130 already recorded "Verified unique: 136/136,
-- 0 null" at 02:21 UTC. This confirms currency. PASS = customers_with_2plus 0.
with eligible as (
  select bc.id as background_check_id, bc.customer_id
  from background_checks bc
  where (bc.eligibility_status = 'Need Manager''s Review' or bc.eligibility_status is null)
    and bc.customer_id is not null
), grouped as (select customer_id, count(*) n from eligible group by customer_id)
select 'Q1 bgcheck sweep-abort' as q,
       (select count(*) from eligible) as qualifying_rows,
       (select count(*) from grouped) as qualifying_customers,
       (select count(*) from grouped where n>=2) as customers_with_2plus,
       (select coalesce(max(n),0) from grouped) as max_rows_per_customer,
       (select coalesce(sum(n),0) from grouped where n>=2) as rows_in_duplicate_groups;

-- ═══ Q2 · is `customer_linked` actually empty? ═══════════════════════════════
-- No application code writes it. If non-empty it may carry the discarded
-- upstream Airtable link = TIER A identity, and Migration B gets far simpler.
select 'Q2 customer_linked population' as q,
       count(*) as total_tickets,
       count(*) filter (where customer_linked is not null and btrim(customer_linked) <> '') as populated,
       count(distinct customer_linked) filter (where customer_linked is not null) as distinct_values,
       (array_agg(distinct left(customer_linked,20)) filter
          (where customer_linked is not null and btrim(customer_linked) <> ''))[1:3] as sample_shape
from tickets;

-- ═══ Q3 · can tickets resolve to active_customers deterministically? ════════
-- Tier ladder dry-run. NO writes. Counts only.
with qual as (
  select t.id, t.requested_by_customer as raw_name, t.phone, t.org_id, t.amount
  from tickets t
  where t.amount > 0
    and (t.status is null or t.status not in ('Closed','Resolved','Done'))
    and t.requested_by_customer is not null
),
m as (
  select q.id, q.org_id,
    (select count(*) from active_customers ac
      where ac.org_id is not distinct from q.org_id
        and lower(btrim(ac.customer_name)) = lower(btrim(q.raw_name)))            as n_name,
    (select count(*) from active_customers ac
      where ac.org_id is not distinct from q.org_id
        and right(regexp_replace(coalesce(ac.contact_phone,''),'\D','','g'),10)
          = right(regexp_replace(coalesce(q.phone,''),'\D','','g'),10)
        and length(regexp_replace(coalesce(q.phone,''),'\D','','g')) >= 10)       as n_phone
  from qual q
)
select 'Q3 resolution ladder' as q,
       count(*)                                                as qualifying_tickets,
       count(*) filter (where n_phone = 1)                     as tierB_phone_unique,
       count(*) filter (where n_phone <> 1 and n_name = 1)     as tierC_name_unique,
       count(*) filter (where n_phone > 1 or n_name > 1)       as tierD_ambiguous,
       count(*) filter (where n_phone = 0 and n_name = 0)      as tierE_unmatched
from m;

-- ═══ Q4 · conflict matrix — name says A, phone says B ═══════════════════════
select 'Q4 identity disagreement' as q,
       count(*) as tickets_where_name_and_phone_resolve_differently
from tickets t
where t.amount > 0
  and (t.status is null or t.status not in ('Closed','Resolved','Done'))
  and t.requested_by_customer is not null
  and exists (select 1 from active_customers a
               where lower(btrim(a.customer_name)) = lower(btrim(t.requested_by_customer))
                 and a.org_id is not distinct from t.org_id)
  and exists (select 1 from active_customers b
               where right(regexp_replace(coalesce(b.contact_phone,''),'\D','','g'),10)
                   = right(regexp_replace(coalesce(t.phone,''),'\D','','g'),10)
                 and length(regexp_replace(coalesce(t.phone,''),'\D','','g')) >= 10
                 and b.org_id is not distinct from t.org_id
                 and b.id <> (select a2.id from active_customers a2
                               where lower(btrim(a2.customer_name)) = lower(btrim(t.requested_by_customer))
                                 and a2.org_id is not distinct from t.org_id limit 1));

-- ═══ Q5 · TASK DELTA — current free-text groups vs canonical groups ════════
with qual as (
  select t.id, t.requested_by_customer as raw_name, t.amount
  from tickets t
  where t.amount > 0
    and (t.status is null or t.status not in ('Closed','Resolved','Done'))
    and t.requested_by_customer is not null
),
current_groups as (
  select raw_name, sum(amount) tot from qual group by raw_name having sum(amount) >= 50
),
normalised_groups as (
  select lower(btrim(raw_name)) k, sum(amount) tot from qual group by 1 having sum(amount) >= 50
)
select 'Q5 task delta' as q,
       (select count(*) from current_groups)     as current_tasks_freetext,
       (select count(*) from normalised_groups)  as tasks_if_normalised,
       (select count(*) from normalised_groups)
         - (select count(*) from current_groups) as delta_normalisation_only,
       (select count(*) from (
          select lower(btrim(raw_name)) k, sum(amount) tot from qual group by 1
           having sum(amount) >= 50
             and sum(amount) > (select coalesce(max(c.tot),0) from current_groups c
                                 where lower(btrim(c.raw_name)) = lower(btrim(raw_name)))
        ) x)                                     as groups_crossing_threshold_only_when_merged;
-- Q5's last column is the suppressed-work measurement: customers who qualify
-- ONLY once their name variants are combined. Those are collection tasks that
-- should exist today and do not.
