-- G-02 shadow: separate INTERNAL NOTIFICATIONS from CUSTOMER COMMUNICATION
-- (owner decision 2026-09-16, "internal alerts"). SHADOW ONLY: nothing calls this
-- from the application; nothing is blocked, allowed or sent.
--
-- Root cause fixed: the first shadow run evaluated the 28 internal "new lead"
-- alerts with the CUSTOMER evaluator, which looked up the destination address in
-- the GHL contact mirror and found a contact-level DND. A staff notification
-- destination is not a customer, so customer suppression is the wrong policy.
--
-- Model:
--   * comms.internal_destinations: explicitly configured staff/operator/system
--     destinations (channel, normalized address, active, purposes allowed, rate
--     limit and delivery-health fields). Rows are business configuration, created
--     by the owner/operator, never derived from a GHL customer contact.
--   * comms.evaluate_internal_notification(channel, purpose, address): eligible only
--     if the purpose is class 'internal' AND the address is an active configured
--     internal destination for that channel that allows the purpose. It does not
--     read customer suppression, because the destination is not a customer.
--   * comms.evaluate_eligibility (customer evaluator) now BLOCKS any internal-class
--     purpose with internal_purpose_requires_internal_evaluator, so relabelling a
--     customer message as "internal" can never bypass customer DND/STOP/consent.
--   * comms.run_shadow_batch uses the internal evaluator for outbox internal alerts.

create table if not exists comms.internal_destinations (
  id                     bigint generated always as identity primary key,
  org_id                 uuid,
  recipient_role         text not null check (recipient_role in ('owner', 'staff', 'operator', 'system')),
  label                  text not null,
  channel                text not null check (channel in ('email', 'sms', 'slack', 'telegram', 'imessage', 'push')),
  address_norm           text not null,
  active                 boolean not null default true,
  purposes_allowed       text[] not null,
  rate_limit_per_hour    integer check (rate_limit_per_hour is null or rate_limit_per_hour > 0),
  last_delivery_ok_at    timestamptz,
  last_delivery_fail_at  timestamptz,
  consecutive_failures   integer not null default 0,
  created_at             timestamptz not null default now(),
  created_by             text not null,
  disabled_at            timestamptz,
  disabled_reason        text,
  unique (channel, address_norm)
);
alter table comms.internal_destinations enable row level security;
revoke all on comms.internal_destinations from public, anon, authenticated;

insert into comms.reason_codes (code, severity, description) values
  ('internal_purpose_requires_internal_evaluator', 'block', 'Internal-class purpose sent to the customer evaluator; internal notifications use evaluate_internal_notification'),
  ('purpose_not_internal',                        'block', 'Internal evaluator called with a customer-facing purpose'),
  ('internal_destination_not_configured',         'block', 'Address is not a configured internal destination for this channel'),
  ('internal_destination_inactive',               'block', 'Configured internal destination is disabled'),
  ('internal_purpose_not_allowed',                'block', 'Configured internal destination does not allow this purpose')
on conflict (code) do update set severity = excluded.severity, description = excluded.description;

create or replace function comms.evaluate_internal_notification(p_channel text, p_purpose text, p_address text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_reasons jsonb := '[]'::jsonb;
  v_class   text;
  v_dest    comms.internal_destinations%rowtype;
  v_addr    text := case when lower(p_channel) in ('sms', 'imessage') then comms.phone10(p_address)
                         else nullif(lower(btrim(coalesce(p_address, ''))), '') end;
begin
  select class into v_class from comms.purposes where key = p_purpose;
  if v_class is null then
    v_reasons := v_reasons || jsonb_build_object('code','purpose_unknown','severity','block');
  elsif v_class <> 'internal' then
    v_reasons := v_reasons || jsonb_build_object('code','purpose_not_internal','severity','block');
  end if;

  if v_addr is null then
    v_reasons := v_reasons || jsonb_build_object('code','destination_missing','severity','block');
  else
    select * into v_dest from comms.internal_destinations d
     where d.channel = lower(p_channel) and d.address_norm = v_addr;
    if not found then
      v_reasons := v_reasons || jsonb_build_object('code','internal_destination_not_configured','severity','block');
    else
      if not v_dest.active or v_dest.disabled_at is not null then
        v_reasons := v_reasons || jsonb_build_object('code','internal_destination_inactive','severity','block');
      end if;
      if not (p_purpose = any(v_dest.purposes_allowed)) then
        v_reasons := v_reasons || jsonb_build_object('code','internal_purpose_not_allowed','severity','block');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'decision', case when jsonb_array_length(v_reasons) = 0 then 'eligible' else 'blocked' end,
    'reasons', v_reasons, 'purpose', p_purpose, 'channel', lower(p_channel),
    'evaluator', 'internal', 'evaluator_version', 'g02-shadow-2');
end $$;

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
  elsif v_purpose.class = 'internal' then
    -- Internal notifications are evaluated only by comms.evaluate_internal_notification
    -- against configured staff destinations. Relabelling a customer message as
    -- internal can never skip customer suppression.
    v_reasons := v_reasons || jsonb_build_object('code','internal_purpose_requires_internal_evaluator','severity','block');
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
                            'purpose', p_purpose, 'channel', lower(p_channel), 'evaluator', 'customer', 'evaluator_version', 'g02-shadow-2');
end $$;

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
          then jsonb_build_object('decision','not_a_send','reasons','[]'::jsonb,'evaluator_version','g02-shadow-2')
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
      cross join lateral (select comms.evaluate_internal_notification(o.channel, 'internal_alert', o.to_address) e) x
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

revoke all on function comms.evaluate_internal_notification(text, text, text) from public, anon, authenticated;
grant execute on function comms.evaluate_internal_notification(text, text, text) to service_role;
