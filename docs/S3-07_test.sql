-- S3-07 TEST PLAN — run in a safe environment after up.sql; ends with ROLLBACK.
begin;

-- Fixtures (synthetic; no real customer data)
insert into public.active_customers (id, customer_name, contact_email, contact_phone, status, org_id) values
  ('00000000-0000-4000-8000-0000000c0001', 'TEST Good',     'good.s307@example.invalid',    '+15550200001', 'Active',  '8e651b25-e7c8-4356-af64-1716a82053b0'),
  ('00000000-0000-4000-8000-0000000c0002', 'TEST Overdue',  'overdue.s307@example.invalid', '+15550200002', 'Active',  '8e651b25-e7c8-4356-af64-1716a82053b0'),
  ('00000000-0000-4000-8000-0000000c0003', 'TEST Removed',  'removed.s307@example.invalid', '+15550200003', 'Removed', '8e651b25-e7c8-4356-af64-1716a82053b0'),
  ('00000000-0000-4000-8000-0000000c0004', 'TEST Blocked',  'blocked.s307@example.invalid', '+15550200004', 'Active',  '8e651b25-e7c8-4356-af64-1716a82053b0');
insert into public.customer_payments (customer, customer_name, customer_phone_number, payment_status, next_payment_due_date, org_id) values
  ('TEST Good',    'TEST Good',    '+15550200001', 'Paid',    current_date + 7, '8e651b25-e7c8-4356-af64-1716a82053b0'),
  ('TEST Overdue', 'TEST Overdue', '+15550200002', 'Overdue', current_date - 3, '8e651b25-e7c8-4356-af64-1716a82053b0');
insert into public.cases (id, customer_email, status) values ('00000000-0000-4000-8000-0000000d0001', 'blocked.s307@example.invalid', 'blocked');
insert into public.active_customers (id, customer_name, contact_email, contact_phone, status, org_id) values
  ('00000000-0000-4000-8000-0000000c0005', 'TEST Escalated', 'escalated.s307@example.invalid', '+15550200005', 'Active', '8e651b25-e7c8-4356-af64-1716a82053b0'),
  ('00000000-0000-4000-8000-0000000c0006', 'TEST Dup A',     'dup.s307@example.invalid',       '+15550200006', 'Active', '8e651b25-e7c8-4356-af64-1716a82053b0'),
  ('00000000-0000-4000-8000-0000000c0007', 'TEST Dup B',     'dup.s307@example.invalid',       '+15550200007', 'Removed','8e651b25-e7c8-4356-af64-1716a82053b0');
insert into public.crm_sync_records (customer_email, canonical_stage, sync_status) values
  ('escalated.s307@example.invalid', 'escalation', 'verified'),
  ('good.s307@example.invalid',      'escalation', 'pending');   -- unverified rows must NOT count

-- T1 Good standing: active, paid, no escalation, no blocked case -> TRUE
select public.compute_good_standing('good.s307@example.invalid') as t1_expect_true;
-- T2 Overdue payment -> FALSE
select public.compute_good_standing('overdue.s307@example.invalid') as t2_expect_false;
-- T3 Removed customer -> FALSE
select public.compute_good_standing('removed.s307@example.invalid') as t3_expect_false;
-- T4 Blocked case -> FALSE
select public.compute_good_standing('blocked.s307@example.invalid') as t4_expect_false;
-- T5 Unknown email -> FALSE (matches original "no booking => false")
select public.compute_good_standing('nobody@example.invalid') as t5_expect_false;
-- T6 Case-insensitive / whitespace tolerant
select public.compute_good_standing('  GOOD.S307@EXAMPLE.INVALID ') as t6_expect_true;
-- T7 View exposes the four facts + source_model
select customer_key, has_active_relationship, has_overdue_payment, is_escalated, has_blocked_case, in_good_standing, source_model
  from public.v_customer_standing where customer_key like '%.s307@example.invalid' order by customer_key;
-- T8 Signature/qualifiers unchanged
select pg_get_function_arguments('public.compute_good_standing'::regproc) = 'p_email text' as t8_sig,
       (select prosecdef and provolatile = 's' from pg_proc where oid = 'public.compute_good_standing'::regproc) as t8_definer_stable;
-- T10 Verified escalation stage -> FALSE; unverified escalation row on 'good' ignored (T1 still TRUE above)
select public.compute_good_standing('escalated.s307@example.invalid') as t10_expect_false;
-- T11 Duplicate email with one Active and one Removed row -> conservative FALSE
select public.compute_good_standing('dup.s307@example.invalid') as t11_expect_false;
-- T9 compute_lto_eligible untouched (still callable; false for a journey-less email)
-- select public.compute_lto_eligible(null, 'good.s307@example.invalid') as t9_expect_false;   -- run in branch (needs full journey stack)

rollback;
