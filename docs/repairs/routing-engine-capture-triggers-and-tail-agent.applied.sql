-- VERBATIM body applied to prod (uapxakmlwnpfsftfeezx) as ledger version
-- 20260826045839 routing_engine_capture_triggers_and_tail_agent (2026-08-26).
-- Copied from supabase_migrations.schema_migrations.statements[1]. Historical
-- record only: do NOT run. The fresh-environment-safe form is in
-- supabase/migrations/20260826045839_routing_engine_capture_triggers_and_tail_agent.sql.
-- Everything after the marker line below is byte-identical to the ledger body
-- (md5 273bab1e05a2f8a272a1a05ff1556f7a; checked by
-- scripts/tests/sql/agent-queue-migrations.rehearsal.mjs --verify-verbatim).
-- ===== VERBATIM BODY BELOW =====
-- Wire capture, the model fallback for the 7% rules cannot settle, and auto-routing.

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

drop trigger if exists capture_lead_intake_trg on public.incoming_leads;
create trigger capture_lead_intake_trg
  after insert on public.incoming_leads
  for each row execute function public.capture_lead_intake();

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

drop trigger if exists capture_form_intake_trg on public.customer_intake_forms;
create trigger capture_form_intake_trg
  after insert on public.customer_intake_forms
  for each row execute function public.capture_form_intake();

-- ── Route as soon as a program is known ───────────────────────────────
create or replace function public.auto_route_intake()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  perform public.route_intake_event(new.id);
  return null;
end $fn$;

drop trigger if exists auto_route_intake_trg on public.intake_events;
create trigger auto_route_intake_trg
  after insert or update of program on public.intake_events
  for each row
  when (new.program is not null and new.routed_at is null)
  execute function public.auto_route_intake();

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

drop trigger if exists agent_enqueue_intake_events on public.intake_events;
create trigger agent_enqueue_intake_events
  after insert on public.intake_events
  for each row execute function public.agent_enqueue();

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