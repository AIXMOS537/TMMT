-- Capture the operator provisioning rail into version control.
--
-- These five functions run the entire paid-operator onboarding path (org +
-- operator profile + token grant + training enrollment + affiliate link), but
-- until now they existed ONLY in the live database `uapxakmlwnpfsftfeezx` --
-- no migration, no local source. A restore-from-migrations would have produced
-- a database where provisioning silently does not exist.
--
-- Definitions below are dumped verbatim from prod via pg_get_functiondef on
-- 2026-07-16. Re-applying against prod is a no-op; the value is that the rail
-- is now reproducible from this repo.
--
-- All five are SECURITY DEFINER. Execute grants are intentionally NOT altered
-- here -- prod already revokes provision_operator_webhook from anon/authenticated
-- and that posture is preserved by not touching it.

-- ============================================================
-- operator_provision: redeem a one-time install token, bind hardware.
-- ============================================================
CREATE OR REPLACE FUNCTION public.operator_provision(p_org uuid, p_install_token text, p_hardware_uuid text, p_new_key_hash text, p_ip inet DEFAULT NULL::inet)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_lic organization_licenses%rowtype;
  v_expected text;
  v_now timestamptz := now();
begin
  select * into v_lic from organization_licenses where organization_id = p_org;
  if not found then
    insert into audit_events(organization_id,hardware_uuid,ip,action,payload)
      values (null,p_hardware_uuid,p_ip,'violation:provision_no_license',
              jsonb_build_object('attempted_org',p_org));
    return jsonb_build_object('status','denied','reason','no_license');
  end if;

  v_expected := encode(digest(p_install_token,'sha256'),'hex');

  if v_lic.install_token_hash is null
     or v_lic.install_token_used
     or v_lic.install_token_hash is distinct from v_expected then
    insert into audit_events(organization_id,hardware_uuid,ip,action,payload)
      values (p_org,p_hardware_uuid,p_ip,'violation:bad_install_token',
              jsonb_build_object('used',v_lic.install_token_used));
    return jsonb_build_object('status','denied','reason','bad_or_used_install_token');
  end if;

  -- Redeem: burn the token, bind hardware, set the new key hash, start the heartbeat.
  update organization_licenses
     set install_token_used = true,
         license_key_hash   = p_new_key_hash,
         hardware_uuid      = coalesce(hardware_uuid, p_hardware_uuid),
         last_heartbeat_at  = v_now,
         updated_at         = v_now
   where organization_id = p_org;

  insert into audit_events(organization_id,hardware_uuid,ip,action,payload)
    values (p_org,p_hardware_uuid,p_ip,'provisioned',
            jsonb_build_object('bound_hardware',p_hardware_uuid));

  return jsonb_build_object('status','provisioned','bound',true);
end $function$;

-- ============================================================
-- provision_install_token: mint a fresh single-use install token for an org.
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_install_token(p_org uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_token text;
begin
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  update public.organization_licenses
     set install_token_hash = encode(sha256(v_token::bytea),'hex'),
         install_token_used = false, hardware_uuid = null, updated_at = now()
   where organization_id = p_org;
  if not found then raise exception 'no license row for org %', p_org; end if;
  return v_token;
end $function$;

-- ============================================================
-- provision_operator: legacy thin path -- profile + affiliate link only.
-- Superseded by provision_operator_full; kept because callers may remain.
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_operator(p_email text, p_revenue_share_pct smallint DEFAULT 25, p_level text DEFAULT 'candidate'::text, p_license_fee_cents integer DEFAULT 0)
 RETURNS TABLE(operator_id uuid, code text, link text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_op uuid; v_code text; v_link text;
begin
  insert into public.operator_profiles(customer_email, level, rubric_score, revenue_share_pct, license_fee_cents, metadata)
  values (p_email, p_level::operator_level, 0, p_revenue_share_pct, p_license_fee_cents, '{}'::jsonb)
  returning id into v_op;
  select c.code, c.link into v_code, v_link from public.create_affiliate_link(v_op, p_revenue_share_pct, '/') c;
  return query select v_op, v_code, v_link;
end $function$;

-- ============================================================
-- provision_operator_full: the one-call onboarding path. Idempotent on email.
--
-- Note for future readers: training enrollment counts rows in
-- operator_training_modules WHERE active. That count is the number of modules a
-- new operator is enrolled in -- it says nothing about whether the module has
-- content behind it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_operator_full(p_email text, p_name text, p_city text DEFAULT NULL::text, p_vertical text DEFAULT 'rental'::text, p_plan_tier text DEFAULT 'starter'::text, p_revenue_share_pct smallint DEFAULT 35, p_license_fee_cents integer DEFAULT 0, p_monthly_tokens integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org_id uuid;
  v_profile_id uuid;
  v_modules int := 0;
  v_existing uuid;
  v_token_event_ok boolean := true;
  v_aff_code text; v_aff_link text; v_aff_ok boolean := true;
begin
  select id into v_existing from operator_profiles where lower(customer_email) = lower(p_email) limit 1;
  if v_existing is not null then
    return jsonb_build_object('status','already_exists','operator_profile_id',v_existing);
  end if;

  insert into organizations (name, kind, vertical, plan_tier, billing_status)
  values (coalesce(p_name, p_email) || ' — ' || coalesce(p_city, 'HQ'), 'tmmt', p_vertical::org_vertical, p_plan_tier, 'active')
  returning id into v_org_id;

  insert into operator_profiles (customer_email, revenue_share_pct, license_fee_cents, org_id, metadata)
  values (lower(p_email), p_revenue_share_pct, p_license_fee_cents, v_org_id,
          jsonb_build_object('name', p_name, 'city', p_city, 'provisioned_by', 'rick', 'provisioned_at', now()))
  returning id into v_profile_id;

  insert into tmmt_token_balances (org_id, balance, monthly_allotment, plan_tier, status)
  values (v_org_id, p_monthly_tokens, p_monthly_tokens, p_plan_tier, 'active')
  on conflict (org_id) do update
    set monthly_allotment = excluded.monthly_allotment, status = 'active', updated_at = now();

  begin
    insert into tmmt_token_events (org_id, delta, reason, dedupe_key, balance_after)
    values (v_org_id, p_monthly_tokens, 'initial_grant:provision_operator_full', 'provision:' || lower(p_email), p_monthly_tokens);
  exception when others then
    v_token_event_ok := false;
  end;

  insert into operator_training_progress (profile_id, module_id, percent_complete)
  select v_profile_id, m.id, 0
  from operator_training_modules m
  where m.active
    and not exists (select 1 from operator_training_progress p
                    where p.profile_id = v_profile_id and p.module_id = m.id);
  get diagnostics v_modules = row_count;

  begin
    select c.code, c.link into v_aff_code, v_aff_link
    from public.create_affiliate_link(v_profile_id, p_revenue_share_pct, '/') c;
  exception when others then
    v_aff_ok := false;
  end;

  return jsonb_build_object(
    'status','provisioned',
    'org_id', v_org_id,
    'operator_profile_id', v_profile_id,
    'modules_enrolled', v_modules,
    'tokens_granted', p_monthly_tokens,
    'token_event_logged', v_token_event_ok,
    'affiliate_code', v_aff_code,
    'affiliate_link', v_aff_link,
    'affiliate_ok', v_aff_ok
  );
end $function$;

-- ============================================================
-- provision_operator_webhook: secret-checked wrapper fronting the edge function
-- `provision-on-payment`. Compares against private.app_config, not a literal.
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_operator_webhook(p_secret text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_expected text;
begin
  select value into v_expected from private.app_config where key = 'provision_webhook_secret';
  if v_expected is null or p_secret is distinct from v_expected then
    return jsonb_build_object('status','unauthorized');
  end if;

  if coalesce(p_payload->>'email','') = '' then
    return jsonb_build_object('status','error','message','email required');
  end if;

  return public.provision_operator_full(
    p_email  => p_payload->>'email',
    p_name   => coalesce(p_payload->>'name', p_payload->>'email'),
    p_city   => p_payload->>'city',
    p_vertical => coalesce(p_payload->>'vertical','rental'),
    p_plan_tier => coalesce(p_payload->>'plan_tier','starter'),
    p_revenue_share_pct => coalesce((p_payload->>'revenue_share_pct')::smallint, 35),
    p_license_fee_cents => coalesce((p_payload->>'license_fee_cents')::integer, 0),
    p_monthly_tokens => coalesce((p_payload->>'monthly_tokens')::integer, 500)
  );
end $function$;
