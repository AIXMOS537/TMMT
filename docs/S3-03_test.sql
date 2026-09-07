-- ============================================================================
-- S3-03 · TEST PLAN (SQL)
-- Run ONLY in a safe environment (Supabase preview branch or local `supabase start`)
-- AFTER up.sql. Every block is wrapped so it leaves no residue: the whole file
-- runs inside one transaction and ends with ROLLBACK.
-- Expected outcome lines are marked  -- EXPECT:
-- ============================================================================
begin;

-- Fixture: one synthetic background check (no real customer data)
insert into public.background_checks (id, customer_name, email, phone_number, own_insurance,
        verification_form_submitted, eligibility_status, org_id)
values ('00000000-0000-4000-8000-00000000a001', 'TEST Applicant', 'test.s303@example.invalid', '+15550100001',
        'No', true, null, '8e651b25-e7c8-4356-af64-1716a82053b0');

-- Simulate a staff caller (auth.uid() = an existing profile id with role admin).
-- In a branch you may instead call as service_role (auth.uid() is null -> actor_kind 'process').
-- select set_config('request.jwt.claims', json_build_object('sub', '<staff profile uuid>', 'role','authenticated')::text, true);

-- ---------------------------------------------------------------------------
-- T1  Backward compatibility: the ORIGINAL 3-argument call still works
-- ---------------------------------------------------------------------------
select public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Eligible', 'T1 notes') as t1;
-- EXPECT: jsonb with to='Eligible' and a non-null decision_event_id
select count(*) = 1 as t1_event_written from public.decision_events where background_check_id = '00000000-0000-4000-8000-00000000a001';
-- EXPECT: true
select reason_code is null and rule_version = 'pre-taxonomy' as t1_pre_taxonomy from public.decision_events where background_check_id = '00000000-0000-4000-8000-00000000a001';
-- EXPECT: true (codes table is empty)

-- ---------------------------------------------------------------------------
-- T2  Pre-taxonomy: Not Eligible WITHOUT a reason is allowed (fail-safe), explanation = notes
-- ---------------------------------------------------------------------------
select public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Not Eligible', 'T2 free-text reason') as t2;
select explanation = 'T2 free-text reason' as t2_explanation_kept from public.decision_events
 where background_check_id = '00000000-0000-4000-8000-00000000a001' order by seq desc limit 1;
-- EXPECT: true

-- ---------------------------------------------------------------------------
-- T3  Once a code exists, Not Eligible WITHOUT a reason must fail
-- ---------------------------------------------------------------------------
insert into public.reason_codes (code, category, label, remediable_by) values ('TEST_DOC_MISSING','DOCUMENT_ADMIN','test','customer');
do $$ begin
  perform public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Not Eligible', 'T3');
  raise exception 'T3 FAILED: expected reason_code requirement to raise';
exception when others then
  if sqlerrm not like '%reason_code is required%' then raise; end if;
  raise notice 'T3 PASS: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- T4  Invalid / inactive code is rejected; Eligible + code is rejected
-- ---------------------------------------------------------------------------
do $$ begin
  perform public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Not Eligible', 'T4', 'NOPE');
  raise exception 'T4a FAILED';
exception when others then
  if sqlerrm not like '%not an active reason code%' then raise; end if; raise notice 'T4a PASS';
end $$;
do $$ begin
  perform public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Eligible', 'T4', 'TEST_DOC_MISSING');
  raise exception 'T4b FAILED';
exception when others then
  if sqlerrm not like '%must not carry a reason code%' then raise; end if; raise notice 'T4b PASS';
end $$;

-- ---------------------------------------------------------------------------
-- T5  Valid decision with code: event row + check columns updated
-- ---------------------------------------------------------------------------
select public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Not Eligible', 'T5', 'TEST_DOC_MISSING', 'License photo unreadable') as t5;
select reason_code = 'TEST_DOC_MISSING' and last_decision_event_id is not null as t5_check_updated
  from public.background_checks where id = '00000000-0000-4000-8000-00000000a001';
-- EXPECT: true
select rule_version = 'taxonomy-v1' as t5_versioned from public.decision_events
 where background_check_id = '00000000-0000-4000-8000-00000000a001' order by seq desc limit 1;
-- EXPECT: true

-- ---------------------------------------------------------------------------
-- T6  Idempotency: same dedupe_key twice -> ONE event, same id returned
-- ---------------------------------------------------------------------------
select public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Need Manager''s Review', 'T6', null, null, null, 'T6-KEY') as t6a;
select public.bg_check_decide('00000000-0000-4000-8000-00000000a001', 'Need Manager''s Review', 'T6', null, null, null, 'T6-KEY') as t6b;
select count(*) = 1 as t6_single_event from public.decision_events where dedupe_key = 'T6-KEY';
-- EXPECT: true

-- ---------------------------------------------------------------------------
-- T7  Snapshot contains no direct identifiers
-- ---------------------------------------------------------------------------
select not (inputs_snapshot ?| array['customer_name','email','phone_number','driver_s_license','paystub','proof_of_insurance']) as t7_no_pii
  from public.decision_events where background_check_id = '00000000-0000-4000-8000-00000000a001' limit 1;
-- EXPECT: true

-- ---------------------------------------------------------------------------
-- T8  Observability view returns the trail with previous_decision
-- ---------------------------------------------------------------------------
select decision, previous_decision, reason_category, recoverable
  from public.v_decision_trail where background_check_id = '00000000-0000-4000-8000-00000000a001' order by seq;
-- EXPECT: 4 rows (T1,T2,T5,T6; T3/T4 raised and wrote nothing); previous_decision lags correctly; reason_category = DOCUMENT_ADMIN on the T5 row

-- ---------------------------------------------------------------------------
-- T9  Existing consumers unaffected: v_prequalified_leads still selects, bg_check_queue still runs
-- ---------------------------------------------------------------------------
select count(*) >= 0 as t9a from public.v_prequalified_leads;
select count(*) >= 0 as t9b from public.bg_check_queue(null, 5);
-- EXPECT: both true (no error)

-- ---------------------------------------------------------------------------
-- T10 Non-staff caller is rejected (run with a non-staff JWT in the branch; expect SQLSTATE 42501)
-- ---------------------------------------------------------------------------
-- select set_config('request.jwt.claims', json_build_object('sub','<non-staff profile uuid>','role','authenticated')::text, true);
-- select public.bg_check_decide('00000000-0000-4000-8000-00000000a001','Eligible');   -- EXPECT: error 42501

-- ---------------------------------------------------------------------------
-- T11 Down/up round-trip (run separately): down.sql then up.sql leaves schema identical
--     and decision_events_archive_s3_03 holds the rows written above.
-- ---------------------------------------------------------------------------

rollback;
