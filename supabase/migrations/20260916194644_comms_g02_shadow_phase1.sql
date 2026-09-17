-- G-02 Universal Communication Eligibility, PHASE 1 = SHADOW ONLY
-- (owner-approved 2026-09-16, decision 5).
--
-- Observes and compares. It does NOT block, allow, send, stage, or change GHL DND,
-- consent, suppression, tasks or customer records. Nothing in the application
-- calls it. It only writes to comms.shadow_decisions.
--
-- Rules encoded:
--   * UNKNOWN IS NOT YES: no consent evidence row = consent_unknown, never consent.
--   * Purpose-aware: the same destination can be eligible for one purpose and not
--     another. There is no single can_contact boolean.
--   * Suppression and consent are separate inputs; contact history is not used as
--     permission.
--   * Cross-channel STOP policy is NOT decided here: an SMS suppression blocks SMS;
--     for other channels it adds review reason cross_channel_policy_undecided.
--   * GHL is read from the local mirror (ghl_contacts.raw_payload.dndSettings).
--     Nothing is pushed to GHL.
--
-- Decision model: eligible | review_required | blocked.
--   any reason with severity 'block'  -> blocked
--   else any reason with 'review'     -> review_required
--   else                              -> eligible
-- Reason codes are stable machine-readable strings, listed in comms.reason_codes.

create schema if not exists comms;
revoke all on schema comms from public, anon, authenticated;
grant usage on schema comms to service_role;

create table if not exists comms.reason_codes (
  code        text primary key,
  severity    text not null check (severity in ('block', 'review')),
  description text not null
);
insert into comms.reason_codes (code, severity, description) values
  ('destination_missing',             'block',  'No usable address for the channel'),
  ('purpose_unknown',                 'block',  'Purpose is not in comms.purposes'),
  ('channel_not_allowed_for_purpose', 'block',  'Purpose does not permit this channel'),
  ('task_closed',                     'block',  'Linked task is handled, dismissed, blocked or quarantined'),
  ('suppressed_manual_dnc',           'block',  'Phone is on do_not_contact_numbers'),
  ('suppressed_sms_optout',           'block',  'An incoming_leads row for this phone is opted_out'),
  ('suppressed_provider_dnd',         'block',  'GHL DND is active for this channel (or GHL global DND)'),
  ('obligation_unverified',           'block',  'Purpose needs a verified obligation and none is verified'),
  ('consent_unknown',                 'review', 'Purpose needs consent evidence and none exists (unknown is not yes)'),
  ('relationship_unverified',         'review', 'Purpose needs a current relationship that is not evidenced'),
  ('owner_approval_missing',          'review', 'Purpose needs owner approval and none is recorded'),
  ('cross_channel_policy_undecided',  'review', 'Destination has a suppression on another channel; cross-channel policy not decided')
on conflict (code) do update set severity = excluded.severity, description = excluded.description;

create table if not exists comms.purposes (
  key                          text primary key,
  class                        text not null check (class in ('internal', 'servicing', 'marketing')),
  allowed_channels             text[] not null,
  consent_required             text not null check (consent_required in ('none', 'relationship', 'record')),
  requires_owner_approval      boolean not null,
  requires_verified_obligation boolean not null,
  description                  text not null
);
-- Mapped from workflows that exist today; not a final legal classification.
insert into comms.purposes values
  ('internal_alert',    'internal',  array['email','sms'],  'none',         false, false, 'Alerts to the owner/staff (automation_outbox notify-new-lead)'),
  ('internal_review',   'internal',  array[]::text[],       'none',         false, false, 'Internal review work, not a communication (bgcheck_review)'),
  ('rental_marketing',  'marketing', array['sms','email'],  'record',       true,  false, 'Re-engaging historical rental leads (lead_reengagement)'),
  ('waitlist_update',   'marketing', array['sms','email'],  'record',       true,  false, 'Telling a waitlisted person a vehicle may be available (waitlist_contact)'),
  ('payment_servicing', 'servicing', array['sms','email'],  'relationship', false, true,  'Payment follow-up on an obligation (payment_followup)'),
  ('ticket_servicing',  'servicing', array['sms','email'],  'relationship', false, true,  'Traffic/toll ticket recovery (ticket_collect)'),
  ('credit_path_offer', 'marketing', array['sms','email'],  'record',       true,  false, 'Offering the credit pathway; only after explicit opt-in')
on conflict (key) do update set class = excluded.class, allowed_channels = excluded.allowed_channels,
  consent_required = excluded.consent_required, requires_owner_approval = excluded.requires_owner_approval,
  requires_verified_obligation = excluded.requires_verified_obligation, description = excluded.description;

create table if not exists comms.task_category_purpose (
  category text primary key,
  purpose  text not null references comms.purposes(key),
  channel  text not null
);
insert into comms.task_category_purpose values
  ('lead_reengagement', 'rental_marketing',  'sms'),
  ('waitlist_contact',  'waitlist_update',   'sms'),
  ('payment_followup',  'payment_servicing', 'sms'),
  ('ticket_collect',    'ticket_servicing',  'sms'),
  ('bgcheck_review',    'internal_review',   'none')
on conflict (category) do update set purpose = excluded.purpose, channel = excluded.channel;

-- Consent evidence: EMPTY by design in Phase 1. No row = UNKNOWN.
create table if not exists comms.consent_evidence (
  id              bigint generated always as identity primary key,
  phone10         text,
  email_norm      text,
  channel         text not null,
  purpose         text not null references comms.purposes(key),
  method          text not null check (method in ('checkbox', 'written', 'verbal_recorded', 'implied_page')),
  confidence      text not null check (confidence in ('record', 'page_level')),
  disclosure_ref  text not null,
  captured_at     timestamptz not null,
  revoked_at      timestamptz,
  check (phone10 is not null or email_norm is not null)
);

create table if not exists comms.shadow_decisions (
  id                bigint generated always as identity primary key,
  evaluated_at      timestamptz not null default now(),
  run_label         text not null,
  evaluator_version text not null,
  subject_kind      text not null,
  subject_ref       text not null,
  channel           text not null,
  purpose           text not null,
  destination_hash  text,          -- sha256 of the normalized destination; no raw PII stored
  current_decision  text not null, -- mirror of today's code path: allow | hold | block | not_a_send
  current_reason    text,
  g02_decision      text not null,
  g02_reasons       jsonb not null,
  comparison        text not null
);
create index if not exists shadow_decisions_run_idx on comms.shadow_decisions (run_label, comparison);

do $$
declare t text;
begin
  foreach t in array array['reason_codes','purposes','task_category_purpose','consent_evidence','shadow_decisions'] loop
    execute format('alter table comms.%I enable row level security', t);
    execute format('revoke all on comms.%I from public, anon, authenticated', t);
  end loop;
end $$;

create or replace function comms.phone10(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '')
$$;

-- The G-02 evaluator. Pure read: no writes. Tables it reads are optional so a
-- fresh environment can build (missing table = no evidence from that source).
create or replace function comms.evaluate_eligibility(
  p_channel text, p_purpose text, p_phone text, p_email text,
  p_task_id uuid default null, p_subject jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_reasons   jsonb := '[]'::jsonb;
  v_purpose   comms.purposes%rowtype;
  v_p10       text := comms.phone10(p_phone);
  v_email     text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_ghl_key   text := case lower(p_channel) when 'sms' then 'SMS' when 'rcs' then 'RCS' when 'email' then 'Email'
                          when 'voice' then 'Call' when 'whatsapp' then 'WhatsApp' else null end;
  v_bool      boolean;
  v_status    text;
  v_handled   timestamptz;
  v_result    jsonb;
  v_src_table text;
  v_src_id    text;
  v_decision  text;
  v_cp_id     text := p_subject->>'customer_payment_id';
  v_approved  boolean := coalesce((p_subject->>'owner_approved')::boolean, false);
begin
  select * into v_purpose from comms.purposes where key = p_purpose;
  if not found then
    v_reasons := v_reasons || jsonb_build_object('code','purpose_unknown','severity','block');
  elsif not (lower(p_channel) = any(v_purpose.allowed_channels)) then
    v_reasons := v_reasons || jsonb_build_object('code','channel_not_allowed_for_purpose','severity','block','channel',p_channel);
  end if;

  if (lower(p_channel) in ('sms','rcs','voice','whatsapp') and v_p10 is null)
     or (lower(p_channel) = 'email' and v_email is null) then
    v_reasons := v_reasons || jsonb_build_object('code','destination_missing','severity','block');
  end if;

  -- Task lifecycle (same rule as src/lib/ops/va-task-lifecycle.ts).
  if p_task_id is not null and to_regclass('public.exec_va_tasks') is not null then
    execute 'select status, handled_at, result, source_table, source_id from public.exec_va_tasks where id = $1'
      into v_status, v_handled, v_result, v_src_table, v_src_id using p_task_id;
    if v_status is null or v_status <> 'pending' or v_handled is not null then
      v_reasons := v_reasons || jsonb_build_object('code','task_closed','severity','block','status',v_status);
    end if;
    if coalesce(v_result ? 'approval', false) then v_approved := true; end if;
    if v_src_table = 'customer_payments' then v_cp_id := coalesce(v_cp_id, v_src_id); end if;
  end if;

  -- Suppression: TMMT manual DNC (phone, all channels that use a phone).
  if v_p10 is not null and to_regclass('public.do_not_contact_numbers') is not null then
    execute 'select exists (select 1 from public.do_not_contact_numbers where phone10 = $1)' into v_bool using v_p10;
    if v_bool then
      if lower(p_channel) in ('sms','rcs','voice','whatsapp') then
        v_reasons := v_reasons || jsonb_build_object('code','suppressed_manual_dnc','severity','block');
      else
        v_reasons := v_reasons || jsonb_build_object('code','cross_channel_policy_undecided','severity','review','source','manual_dnc');
      end if;
    end if;
  end if;

  -- Suppression: SMS opt-out recorded on any lead row for this phone.
  if v_p10 is not null and to_regclass('public.incoming_leads') is not null then
    execute 'select exists (select 1 from public.incoming_leads where opted_out
               and right(regexp_replace(coalesce(phone_e164, phone::text, ''''), ''\D'', '''', ''g''), 10) = $1)'
      into v_bool using v_p10;
    if v_bool then
      if lower(p_channel) = 'sms' then
        v_reasons := v_reasons || jsonb_build_object('code','suppressed_sms_optout','severity','block');
      else
        v_reasons := v_reasons || jsonb_build_object('code','cross_channel_policy_undecided','severity','review','source','sms_optout');
      end if;
    end if;
  end if;

  -- Suppression: GHL DND (mirror). Channel-specific status active/permanent, or global dnd.
  if to_regclass('public.ghl_contacts') is not null and (v_p10 is not null or v_email is not null) then
    execute 'select exists (select 1 from public.ghl_contacts g
               where ((right(regexp_replace(coalesce(g.phone, ''''), ''\D'', '''', ''g''), 10) = $1)
                   or (lower(g.email) = $2))
                 and (g.raw_payload->>''dnd'' = ''true''
                   or (g.raw_payload->''dndSettings''->$3->>''status'') in (''active'', ''permanent'')))'
      into v_bool using v_p10, v_email, v_ghl_key;
    if v_bool then
      v_reasons := v_reasons || jsonb_build_object('code','suppressed_provider_dnd','severity','block','provider','ghl','channel',p_channel);
    elsif lower(p_channel) <> 'sms' then
      execute 'select exists (select 1 from public.ghl_contacts g
                 where ((right(regexp_replace(coalesce(g.phone, ''''), ''\D'', '''', ''g''), 10) = $1) or (lower(g.email) = $2))
                   and (g.raw_payload->''dndSettings''->''SMS''->>''status'') in (''active'', ''permanent''))'
        into v_bool using v_p10, v_email;
      if v_bool then
        v_reasons := v_reasons || jsonb_build_object('code','cross_channel_policy_undecided','severity','review','source','ghl_sms_dnd');
      end if;
    end if;
  end if;

  if v_purpose.key is not null then
    -- Obligation.
    if v_purpose.requires_verified_obligation then
      v_bool := false;
      if v_cp_id is not null and to_regclass('public.payment_obligation_reconciliation') is not null then
        execute 'select exists (select 1 from public.payment_obligation_reconciliation
                   where customer_payment_id::text = $1 and verified_owed_at is not null)' into v_bool using v_cp_id;
      end if;
      if not v_bool then
        v_reasons := v_reasons || jsonb_build_object('code','obligation_unverified','severity','block');
      end if;
    end if;

    -- Consent (UNKNOWN IS NOT YES).
    if v_purpose.consent_required = 'record' then
      select exists (select 1 from comms.consent_evidence c
                      where c.purpose = v_purpose.key and c.channel = lower(p_channel) and c.revoked_at is null
                        and c.confidence = 'record'
                        and ((v_p10 is not null and c.phone10 = v_p10) or (v_email is not null and c.email_norm = v_email)))
        into v_bool;
      if not v_bool then
        v_reasons := v_reasons || jsonb_build_object('code','consent_unknown','severity','review');
      end if;
    elsif v_purpose.consent_required = 'relationship' then
      if not coalesce((p_subject->>'relationship_verified')::boolean, false)
         and not (v_purpose.requires_verified_obligation
                  and not exists (select 1 from jsonb_array_elements(v_reasons) r where r->>'code' = 'obligation_unverified')) then
        v_reasons := v_reasons || jsonb_build_object('code','relationship_unverified','severity','review');
      end if;
    end if;

    if v_purpose.requires_owner_approval and not v_approved then
      v_reasons := v_reasons || jsonb_build_object('code','owner_approval_missing','severity','review');
    end if;
  end if;

  v_decision := case
    when exists (select 1 from jsonb_array_elements(v_reasons) r where r->>'severity' = 'block') then 'blocked'
    when jsonb_array_length(v_reasons) > 0 then 'review_required'
    else 'eligible' end;

  return jsonb_build_object('decision', v_decision, 'reasons', v_reasons,
                            'purpose', p_purpose, 'channel', lower(p_channel), 'evaluator_version', 'g02-shadow-1');
end $$;

-- Shadow batch: evaluates every communication decision that can be observed
-- today and records it beside a mirror of the CURRENT code path. Writes only to
-- comms.shadow_decisions. Returns a summary.
create or replace function comms.run_shadow_batch(p_run_label text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rows int := 0; v_n int;
begin
  if p_run_label is null or length(btrim(p_run_label)) = 0 then raise exception 'run label required'; end if;

  -- 1) VA tasks through the outbox stager (current = va-task-outbox.ts + outbound-gate.ts, default ownerApproved=false).
  if to_regclass('public.exec_va_tasks') is not null then
    insert into comms.shadow_decisions (run_label, evaluator_version, subject_kind, subject_ref, channel, purpose,
                                        destination_hash, current_decision, current_reason, g02_decision, g02_reasons, comparison)
    select p_run_label, ev.e->>'evaluator_version', 'exec_va_task', t.id::text, m.channel, m.purpose,
           case when comms.phone10(t.subject_phone) is not null then encode(sha256(convert_to(comms.phone10(t.subject_phone), 'UTF8')), 'hex') end,
           cur.decision, cur.reason, ev.e->>'decision', ev.e->'reasons',
           cur.decision || '->' || (ev.e->>'decision')
      from public.exec_va_tasks t
      join comms.task_category_purpose m on m.category = t.category
      cross join lateral (
        select case
          when m.channel = 'none' then 'not_a_send'
          when not (t.status = 'pending' and t.handled_at is null) then 'block'
          when nullif(btrim(coalesce(t.subject_phone, '')), '') is null then 'block'
          when t.category in ('lead_reengagement','waitlist_contact') then 'hold'
          when exists (select 1 from public.do_not_contact_numbers d where d.phone10 = comms.phone10(t.subject_phone)) then 'block'
          when exists (select 1 from public.incoming_leads l where l.opted_out and l.phone_e164 = t.subject_phone) then 'block'
          else 'allow' end as decision,
        case
          when m.channel = 'none' then 'internal_review_not_messaged'
          when not (t.status = 'pending' and t.handled_at is null) then 'task_not_open'
          when nullif(btrim(coalesce(t.subject_phone, '')), '') is null then 'no_phone'
          when t.category in ('lead_reengagement','waitlist_contact') then 'marketing_gate_hold_without_owner_click'
          when exists (select 1 from public.do_not_contact_numbers d where d.phone10 = comms.phone10(t.subject_phone)) then 'dnc'
          when exists (select 1 from public.incoming_leads l where l.opted_out and l.phone_e164 = t.subject_phone) then 'opted_out'
          else 'transactional_allowed' end as reason
      ) cur
      cross join lateral (select case when m.channel = 'none'
          then jsonb_build_object('decision','not_a_send','reasons','[]'::jsonb,'evaluator_version','g02-shadow-1')
          else comms.evaluate_eligibility(m.channel, m.purpose, t.subject_phone, t.subject_email, t.id,
                 jsonb_build_object('customer_payment_id', case when t.source_table = 'customer_payments' then t.source_id end))
          end as e) ev
     where t.status in ('pending','blocked_dnc','quarantined_unverified');
    get diagnostics v_n = row_count; v_rows := v_rows + v_n;
  end if;

  -- 2) Outbox internal alerts (current: queued, no drainer = never sent).
  if to_regclass('public.automation_outbox') is not null then
    insert into comms.shadow_decisions (run_label, evaluator_version, subject_kind, subject_ref, channel, purpose,
                                        destination_hash, current_decision, current_reason, g02_decision, g02_reasons, comparison)
    select p_run_label, e->>'evaluator_version', 'automation_outbox', o.id::text, o.channel, 'internal_alert',
           encode(sha256(convert_to(lower(o.to_address), 'UTF8')), 'hex'),
           'allow', 'queued_internal_alert', e->>'decision', e->'reasons', 'allow->' || (e->>'decision')
      from public.automation_outbox o
      cross join lateral (select comms.evaluate_eligibility(o.channel, 'internal_alert',
                            case when o.channel <> 'email' then o.to_address end,
                            case when o.channel = 'email' then o.to_address end) e) x
     where o.automation = 'notify-new-lead';
    get diagnostics v_n = row_count; v_rows := v_rows + v_n;
  end if;

  -- 3) Hypothetical historical outreach (no current path would do this without an owner click):
  --    rental re-engagement by SMS and email, and credit-path offer by email, for every historical lead.
  if to_regclass('public.incoming_leads') is not null then
    insert into comms.shadow_decisions (run_label, evaluator_version, subject_kind, subject_ref, channel, purpose,
                                        destination_hash, current_decision, current_reason, g02_decision, g02_reasons, comparison)
    select p_run_label, e->>'evaluator_version', 'historical_lead', l.id::text, ch.channel, ch.purpose,
           case when ch.channel = 'email' then encode(sha256(convert_to(lower(coalesce(l.email, '')), 'UTF8')), 'hex')
                else encode(sha256(convert_to(coalesce(comms.phone10(coalesce(l.phone_e164, l.phone::text)), ''), 'UTF8')), 'hex') end,
           'hold', 'no_current_path_without_owner_click', e->>'decision', e->'reasons', 'hold->' || (e->>'decision')
      from public.incoming_leads l
      cross join (values ('sms','rental_marketing'), ('email','rental_marketing'), ('email','credit_path_offer')) ch(channel, purpose)
      cross join lateral (select comms.evaluate_eligibility(ch.channel, ch.purpose,
                            coalesce(l.phone_e164, l.phone::text), l.email) e) x;
    get diagnostics v_n = row_count; v_rows := v_rows + v_n;
  end if;

  return jsonb_build_object('run_label', p_run_label, 'rows', v_rows);
end $$;

revoke all on function comms.phone10(text) from public, anon, authenticated;
revoke all on function comms.evaluate_eligibility(text, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function comms.run_shadow_batch(text) from public, anon, authenticated;
grant execute on function comms.phone10(text) to service_role;
grant execute on function comms.evaluate_eligibility(text, text, text, text, uuid, jsonb) to service_role;
grant execute on function comms.run_shadow_batch(text) to service_role;
