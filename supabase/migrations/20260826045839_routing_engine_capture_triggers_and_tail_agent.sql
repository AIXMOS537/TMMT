-- Routing engine wiring: capture triggers, auto-routing, and the intake-router agent
-- (the local-model fallback for enquiries the keyword rules cannot settle).
-- APPLIED to prod as ledger version 20260826045839 (2026-08-26). Exact applied
-- body kept verbatim in docs/repairs/routing-engine-capture-triggers-and-tail-agent.applied.sql.
--
-- Repo form differences (fresh-environment safety only; same objects on prod):
--   * public.intake_events, public.intake_capture(text,text,text,jsonb,uuid) and
--     public.route_intake_event(bigint) are NOT created by any repo migration.
--     Creating the capture triggers without intake_capture would make EVERY insert
--     into incoming_leads / customer_intake_forms fail in a fresh environment, so:
--       - lead/form capture triggers: only if intake_capture exists (and the table does)
--       - auto-route trigger:         only if intake_events and route_intake_event exist
--       - intake_events enqueue trigger: only if intake_events exists
--   * The trigger functions, the backfill function and the intake-router definition
--     row are created regardless (inert until the tables/functions exist).
-- Re-running by hand is harmless (CREATE OR REPLACE / ON CONFLICT / drop+create).

-- ── Capture every new lead ────────────────────────────────────────────
create or replace function public.capture_lead_intake()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  perform public.intake_capture(
    'incoming_leads', new.id::text,
    concat_ws(' ', new.opportunity_name, new.notes, new.sku, new.source_campaign,
                   new.utm_campaign, new.utm_source, new.lane, new.contact_name),
    to_jsonb(new), new.org_id
  );
  return new;
end $fn$;

-- ── Capture every intake form ─────────────────────────────────────────
create or replace function public.capture_form_intake()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  perform public.intake_capture(
    'customer_intake_forms', new.id::text,
    concat_ws(' ', new.request_type, new.subject, new.details, new.source),
    to_jsonb(new), null
  );
  return new;
end $fn$;

-- ── Route as soon as a program is known ───────────────────────────────
create or replace function public.auto_route_intake()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  perform public.route_intake_event(new.id);
  return null;
end $fn$;

do $guard$
declare
  v_capture boolean := to_regprocedure('public.intake_capture(text,text,text,jsonb,uuid)') is not null;
  v_route   boolean := to_regprocedure('public.route_intake_event(bigint)') is not null;
  v_events  boolean := to_regclass('public.intake_events') is not null;
begin
  if v_capture and to_regclass('public.incoming_leads') is not null then
    execute 'drop trigger if exists capture_lead_intake_trg on public.incoming_leads';
    execute 'create trigger capture_lead_intake_trg
               after insert on public.incoming_leads
               for each row execute function public.capture_lead_intake()';
  else
    raise notice 'routing engine: intake_capture or incoming_leads absent; lead capture trigger not created';
  end if;

  if v_capture and to_regclass('public.customer_intake_forms') is not null then
    execute 'drop trigger if exists capture_form_intake_trg on public.customer_intake_forms';
    execute 'create trigger capture_form_intake_trg
               after insert on public.customer_intake_forms
               for each row execute function public.capture_form_intake()';
  else
    raise notice 'routing engine: intake_capture or customer_intake_forms absent; form capture trigger not created';
  end if;

  if v_events and v_route then
    execute 'drop trigger if exists auto_route_intake_trg on public.intake_events';
    execute 'create trigger auto_route_intake_trg
               after insert or update of program on public.intake_events
               for each row
               when (new.program is not null and new.routed_at is null)
               execute function public.auto_route_intake()';
  else
    raise notice 'routing engine: intake_events or route_intake_event absent; auto-route trigger not created';
  end if;
end
$guard$;

-- ── The 7% rules cannot settle: hand to the local model ───────────────
-- Reuses the agent spine. The worker claims it, asks rick, and the answer lands in
-- intake_events.program, which fires the routing trigger above.
insert into public.agent_definitions
  (slug, name, description, source_table, fire_on, only_when_null,
   target_field, model, temperature, active, prompt_template)
values (
  'intake-router',
  'Intake router',
  'Decides which program an enquiry belongs to when keyword rules cannot.',
  'intake_events', 'insert', 'program', 'program', 'rick', 0, true,
$prompt$You route enquiries for a vehicle rental and credit business.

Reply with EXACTLY ONE of these program codes, nothing else:
rentals_rideshare
credit_repair
lease_to_own
detailing
operator_program
partner_fleet
general

What each one means:
- rentals_rideshare : wants to rent a car to drive for Uber, Lyft, DoorDash or similar
- credit_repair     : wants help with credit score, disputes, collections, tradelines
- lease_to_own      : wants to end up owning the vehicle
- detailing         : wants detailing, tint, ceramic coating, PPF or dent work
- operator_program  : wants to run their own branch or territory of the business
- partner_fleet     : owns a vehicle and wants to put it into the fleet, or a JV or investor
- general           : anything else, or too little information to tell

If you cannot tell, answer general. Reply with the code only.

Enquiry
{{haystack}}
$prompt$
)
on conflict (slug) do update set
  prompt_template = excluded.prompt_template,
  target_field    = excluded.target_field,
  only_when_null  = excluded.only_when_null,
  active          = excluded.active,
  updated_at      = now();

do $guard$
begin
  if to_regclass('public.intake_events') is null then
    raise notice 'routing engine: intake_events absent; agent enqueue trigger not created';
    return;
  end if;
  execute 'drop trigger if exists agent_enqueue_intake_events on public.intake_events';
  execute 'create trigger agent_enqueue_intake_events
             after insert on public.intake_events
             for each row execute function public.agent_enqueue()';
end
$guard$;

-- ── Backfill: classify the existing lead history ──────────────────────
create or replace function public.backfill_lead_intake(p_limit int default 2000)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_captured int := 0;
begin
  with todo as (
    select l.id,
           concat_ws(' ', l.opportunity_name, l.notes, l.sku, l.source_campaign,
                          l.utm_campaign, l.utm_source, l.lane, l.contact_name) as hay,
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

revoke all on function public.backfill_lead_intake(int) from public, anon, authenticated;
grant execute on function public.backfill_lead_intake(int) to service_role;
