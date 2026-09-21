-- Privacy + accuracy fix: contact_name removed from the routing haystack (lead capture
-- trigger function and the backfill function).
-- APPLIED to prod as ledger version 20260826050151 (2026-08-26). Exact applied body kept
-- verbatim in docs/repairs/routing-engine-drop-name-from-haystack.applied.sql.
--
-- Repo form: identical statements. Both are CREATE OR REPLACE FUNCTION with runtime-only
-- dependencies (no table/function is resolved at create time), so it is fresh-safe as-is.
-- Re-running by hand is harmless.
-- Root fix for the hallucination: contact_name never belonged in the classification text.
--
-- A person's name says nothing about which program they want, but it does make an empty
-- record look like it has content — "cherita harris" passes any is-there-text check and
-- reaches the model, which then invents a category. Names are removed from the haystack
-- entirely, so nameless records fall through to `general` by rule as intended.

create or replace function public.capture_lead_intake()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  perform public.intake_capture(
    'incoming_leads', new.id::text,
    concat_ws(' ', new.opportunity_name, new.notes, new.sku, new.source_campaign,
                   new.utm_campaign, new.utm_source, new.lane),
    to_jsonb(new), new.org_id
  );
  return new;
end $fn$;

create or replace function public.backfill_lead_intake(p_limit int default 2000)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_captured int := 0;
begin
  with todo as (
    select l.id,
           concat_ws(' ', l.opportunity_name, l.notes, l.sku, l.source_campaign,
                          l.utm_campaign, l.utm_source, l.lane) as hay,
           l.org_id
    from public.incoming_leads l
    where not exists (
      select 1 from public.intake_events e
      where e.source = 'incoming_leads' and e.record_id = l.id::text
    )
    limit greatest(1, p_limit)
  ), done as (
    select public.intake_capture('incoming_leads', id::text, hay, null, org_id) as ev from todo
  )
  select count(*) into v_captured from done;
  return jsonb_build_object('captured', v_captured);
end $fn$;
