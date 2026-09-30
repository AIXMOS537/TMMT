-- 20260902012451_remote_schema_baseline.sql
-- Generated from live-baseline-2026-09-01.sql by scripts/baseline-from-dump.ps1
--
-- This is the schema of record. It reflects the live database as of the dump
-- above, after 192 changes had been applied to production without ever being
-- written back to this repo.
--
-- It is recorded as ALREADY APPLIED on the live project. Do not re-run it
-- against production. New work goes in migrations dated after this one.
-- live-baseline generated 2026-09-01 from project uapxakmlwnpfsftfeezx (schema: public)
-- Source: pg_catalog introspection (pg_get_constraintdef / _indexdef / _functiondef /
-- _triggerdef / _viewdef and pg_policies) - the same definitions pg_dump reads.
-- Objects: 161 tables, 21 views, 258 functions, 338 policies, 549 indexes, 41 enums.

set check_function_bodies = off;

-- ============ 1. EXTENSIONS ============
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema public;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema public;
create extension if not exists wrappers with schema extensions;

-- ============ 2. ENUM TYPES ============
create type public.admin_scope as enum ('super', 'manager', 'finance', 'content');
create type public.agent_name as enum ('vision', 'tank', 'fly_guy', 'bob', 'sticks');
create type public.agent_vote as enum ('approve', 'reject', 'abstain');
create type public.booking_status as enum ('inquiry', 'quoted', 'confirmed', 'active', 'completed', 'cancelled');
create type public.canonical_renter_stage as enum ('inquiry', 'contacted', 'qualifying', 'payment_pending', 'booked', 'pickup_scheduled', 'active_renter', 'return_due', 'returned', 'extended', 'escalation', 'closed_won', 'closed_lost');
create type public.contract_type as enum ('rental_agreement', 'lto_purchase_agreement', 'vehicle_turnover', 'vehicle_exchange', 'operator_license');
create type public.coo_briefing_kind as enum ('daily', 'weekly');
create type public.counselor_channel as enum ('call', 'zoom', 'sms', 'email', 'task', 'slack', 'manual');
create type public.counselor_disc as enum ('D', 'I', 'S', 'C', 'DI', 'DC', 'SI', 'SC', 'CD', 'CS');
create type public.counselor_driver as enum ('data', 'money_fear', 'social', 'authority', 'speed', 'legacy');
create type public.counselor_outcome as enum ('accepted', 'deferred', 'resisted', 'moved', 'unknown');
create type public.counselor_resistance as enum ('deflect', 'dominate', 'silent', 'intellectualize', 'deny', 'overpromise');
create type public.counselor_stakes as enum ('low', 'med', 'high', 'critical');
create type public.counselor_trust as enum ('cold', 'guarded', 'open', 'bought_in');
create type public.credit_path as enum ('monthly_97', 'payment_plan_500', 'mentorship_dfy_1000');
create type public.credit_plan_status as enum ('draft', 'active', 'paused', 'completed', 'cancelled');
create type public.damage_severity as enum ('minor', 'moderate', 'major');
create type public.damage_status as enum ('reported', 'in_review', 'repair_scheduled', 'resolved');
create type public.deal_status as enum ('working', 'pending', 'sold', 'funded', 'cancelled');
create type public.delivery_mode as enum ('self_guided_training', 'done_for_you');
create type public.insurance_coverage_source as enum ('renter_own', 'tmmt_internal', 'corporate_non_owner', 'pending');
create type public.job_delivery_status as enum ('pending', 'delivered', 'failed', 'acknowledged');
create type public.ledger_entry_status as enum ('pending', 'processing', 'completed', 'cancelled');
create type public.ledger_entry_type as enum ('deposit', 'deposit_return', 'payment', 'deduction', 'expense', 'refund', 'insurance_premium');
create type public.license_tier as enum ('rentals_app', 'full_os', 'custom');
create type public.marketplace_listing_type as enum ('deal', 'vendor', 'opportunity');
create type public.operator_level as enum ('candidate', 'certified', 'senior', 'master');
create type public.org_vertical as enum ('rental', 'dealer', 'property', 'service_arbitrage');
create type public.partner_client_segment as enum ('retail', 'business_owner');
create type public.partner_revenue_split_tier as enum ('90_10', '80_20', '70_30', '60_40', '50_50');
create type public.payment_status as enum ('pending', 'authorized', 'captured', 'failed', 'refunded');
create type public.portal_role as enum ('client', 'team_member', 'manager', 'admin', 'super_admin');
create type public.program_application_status as enum ('onboarding', 'questionnaire_in_progress', 'questionnaire_complete', 'coach_reviewed', 'advisor_reviewed', 'admin_reviewed', 'supervisor_approved', 'client_consent_given', 'submitted', 'prepared_for_manual', 'returned_for_corrections');
create type public.program_funding_track as enum ('personal', 'business', 'both');
create type public.program_track as enum ('renter', 'credit', 'lto', 'operator_candidate', 'operator');
create type public.protocol_run_status as enum ('pending', 'running', 'completed', 'failed', 'skipped');
create type public.sync_record_status as enum ('pending_airtable', 'pending_verification', 'verified', 'rejected', 'error');
create type public.team_department as enum ('sales', 'support', 'training', 'ops', 'general');
create type public.user_role as enum ('admin', 'internal_team', 'investor', 'vendor', 'customer');
create type public.vehicle_event_type as enum ('turnover', 'exchange', 'return_inspection', 'lto_start', 'lto_complete');
create type public.vehicle_tier as enum ('economy', 'mid', 'luxury');

-- ============ 3. SEQUENCES ============
create sequence if not exists public.agent_messages_id_seq as bigint increment by 1 start with 1;
create sequence if not exists public.audit_events_id_seq as bigint increment by 1 start with 1;

-- ============ 4. TABLES ============
create table if not exists public.active_customers (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  customer_name text,
  contact_phone text,
  contact_email text,
  vehicle_rented text,
  status text,
  repo_status text,
  vehicle_plate text,
  vehicle_vin text,
  rental_start_date date,
  payment_amount text,
  payment_frequency text,
  service_notes text,
  scheduled_maintenance timestamp with time zone,
  payment_reliability_rating text,
  ticket_balance_status text,
  tickets_2 text,
  license_plate text,
  vin text,
  tickets text,
  drivers_license_front_path text,
  drivers_license_back_path text,
  license_upload_token uuid,
  license_upload_token_expires_at timestamp with time zone,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.affiliate_links (
  id uuid not null default gen_random_uuid(),
  operator_id uuid not null,
  code text not null,
  landing_path text default '/'::text,
  recurring_pct smallint not null default 20,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.agent_conversations (
  id uuid not null default gen_random_uuid(),
  lead_id uuid not null,
  organization_id uuid not null,
  channel text not null,
  started_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone,
  state_at_end text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.agent_definitions (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  source_table text not null,
  fire_on text not null default 'insert'::text,
  watch_fields text[],
  only_when_null text,
  prompt_template text not null,
  target_field text,
  model text not null default 'rick'::text,
  temperature numeric not null default 0,
  max_attempts integer not null default 3,
  active boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.agent_evaluation_sessions (
  id uuid not null default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  required_approvals smallint not null default 3,
  panel_size smallint not null default 5,
  status text not null default 'pending'::text,
  decision text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.agent_evaluations (
  id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  agent agent_name not null,
  vote agent_vote not null,
  rationale text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.agent_jobs (
  id bigint generated always as identity not null,
  agent_slug text not null,
  source_table text not null,
  record_id text not null,
  status text not null default 'queued'::text,
  prompt text,
  response text,
  error text,
  attempts integer not null default 0,
  claimed_by text,
  claimed_at timestamp with time zone,
  finished_at timestamp with time zone,
  org_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.agent_messages (
  id bigint not null default nextval('agent_messages_id_seq'::regclass),
  conversation_id uuid not null,
  ts timestamp with time zone not null default now(),
  direction text not null,
  body text not null,
  llm_assessment jsonb,
  compliance_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.appointments (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  appointment_id bigint,
  waitlist_customer text,
  appointment_type text,
  vehicle_preference_confirmed boolean,
  preferred_vehicle_make_model text,
  appointment_date_time timestamp with time zone,
  appointment_status text,
  assigned_staff text,
  location text,
  notes text,
  confirmed_time_slot text,
  appointment_time text,
  status text,
  phone text,
  email text,
  appointment_date date,
  customer_name text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.assignment_overrides (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  incident_id uuid not null,
  original_unit_id uuid not null,
  chosen_unit_id uuid not null,
  reason text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.audit_events (
  id bigint not null default nextval('audit_events_id_seq'::regclass),
  ts timestamp with time zone not null default now(),
  organization_id uuid,
  hardware_uuid text,
  ip inet,
  action text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.automation_outbox (
  id bigint generated always as identity not null,
  automation text not null,
  channel text not null default 'email'::text,
  to_address text not null,
  subject text,
  body text,
  source_table text,
  record_id text,
  status text not null default 'queued'::text,
  error text,
  sent_at timestamp with time zone,
  org_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.background_checks (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  customer_name text,
  phone_number text,
  email text,
  driver_s_license jsonb,
  own_insurance text,
  proof_of_insurance jsonb,
  paystub jsonb,
  verificaton_form_submitted boolean,
  background_check_screenshot jsonb,
  key_details_extracted_from_screenshot text,
  review_notes text,
  eligibility_status text,
  available_vehicles text,
  waitlist text,
  customer_id bigint,
  background_check_status text,
  insurance_check_status text,
  earnings_verification_status text,
  date_verified date,
  linked_lead text,
  verification_form_submitted boolean,
  drivers_license_front_path text,
  drivers_license_back_path text,
  license_upload_token uuid,
  license_upload_token_expires_at timestamp with time zone,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid),
  reviewed_by uuid,
  reviewed_at timestamp with time zone
);

create table if not exists public.bills (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  owner_id uuid not null default auth.uid(),
  scope text not null default 'Personal'::text,
  name text not null,
  vendor text,
  category text,
  amount numeric(12,2) not null default 0,
  cycle text not null default 'Monthly'::text,
  status text not null default 'Active'::text,
  next_due_date date,
  auto_pay boolean not null default false,
  payment_method text,
  billed_to text,
  manage_url text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.bookings (
  id uuid not null default gen_random_uuid(),
  ref_code text not null default ('B-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8))),
  profile_id uuid,
  case_id uuid,
  customer_name text not null default 'Guest'::text,
  customer_email text,
  customer_phone text,
  status text not null default 'inquiry'::text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  vehicle_id uuid,
  manager_discount_approved_at timestamp with time zone,
  manager_discount_approved_by uuid,
  requires_manager_discount_approval boolean default false,
  supervisor_discount_approved_at timestamp with time zone,
  supervisor_discount_approved_by uuid,
  discount_approval_tier text,
  vehicle_tier vehicle_tier,
  quoted_daily_cents integer,
  quoted_weekly_cents integer,
  quoted_deposit_cents integer,
  pricing_rule_id uuid,
  insurance_coverage_source insurance_coverage_source default 'pending'::insurance_coverage_source,
  insurance_verified boolean not null default false,
  lot_release_approved boolean not null default false,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.case_client_updates (
  id uuid not null default gen_random_uuid(),
  case_id uuid,
  customer_email text not null,
  message text not null,
  posted_by uuid,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.case_status_history (
  id uuid not null default gen_random_uuid(),
  case_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid,
  note text,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.cases (
  id uuid not null default gen_random_uuid(),
  ref_code text default ('C-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8))),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  request_type text not null default 'rental_booking'::text,
  subject text not null default 'GHL sync'::text,
  description text,
  status text not null default 'internal_review'::text,
  metadata jsonb not null default '{}'::jsonb,
  airtable_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  assigned_to uuid,
  assigned_at timestamp with time zone,
  work_type text,
  routing_status text default 'pending'::text,
  clickup_task_id text,
  clickup_task_url text,
  intake_id uuid,
  business_line text,
  case_type text,
  agent_draft jsonb,
  required_capabilities text[],
  org_id uuid
);

create table if not exists public.clickup_tasks (
  id uuid not null default gen_random_uuid(),
  case_id uuid,
  clickup_task_id text not null,
  clickup_url text,
  list_name text,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.client_alerts (
  id uuid not null default gen_random_uuid(),
  profile_id uuid,
  customer_email text not null,
  ghl_contact_id text,
  sync_record_id uuid,
  alert_type text not null,
  canonical_stage text,
  title text not null,
  message text not null,
  priority text not null default 'normal'::text,
  due_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.client_journey (
  id uuid not null default gen_random_uuid(),
  profile_id uuid,
  customer_email text not null,
  ghl_contact_id text,
  program_track program_track not null default 'renter'::program_track,
  booking_id uuid,
  vehicle_id uuid,
  good_standing boolean not null default false,
  good_standing_since timestamp with time zone,
  good_standing_days integer not null default 0,
  lto_eligible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  partner_client_segment partner_client_segment,
  partner_revenue_split_tier partner_revenue_split_tier,
  partner_has_startup_capital boolean not null default false,
  partner_qualified_vehicle_count integer not null default 0,
  partner_has_own_system boolean not null default false,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.client_updates (
  id uuid not null default gen_random_uuid(),
  client_email text not null,
  partner_slug text,
  stage text,
  stage_label text,
  message text,
  notified boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.comm_channels (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  label text not null,
  provider text not null,
  phone text,
  purpose text,
  direction text not null default 'both'::text,
  policy text not null default 'normal'::text,
  working_hours jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.contract_instances (
  id uuid not null default gen_random_uuid(),
  journey_id uuid not null,
  contract_type contract_type not null,
  title text not null,
  status text not null default 'pending'::text,
  document_id uuid,
  signed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.contracts (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  contract_id bigint,
  active_customer text,
  vehicle text,
  start_date date,
  end_date date,
  base_price numeric,
  taxes_and_fees numeric,
  insurance_fee numeric,
  total_contract_amount numeric,
  signatures_customer_staff jsonb,
  contract_status text,
  addendums jsonb,
  notes text,
  contract_sent_date date,
  signed_date date,
  vehicle_handover text,
  former_customers text,
  status text,
  contract_pdf_storage_path text,
  contract_pdf_uploaded_at timestamp with time zone,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.coo_briefings (
  id uuid not null default gen_random_uuid(),
  briefing_date date not null,
  kind coo_briefing_kind not null,
  pipeline_health text,
  escalations text,
  director_sync text,
  blockers text,
  weekly_summary text,
  loom_url text,
  submitted_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.counselor_escalation_state (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  issue text not null,
  level integer not null default 0,
  reason text,
  updated_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.counselor_interaction (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  channel counselor_channel not null default 'manual'::counselor_channel,
  source_ref text,
  signals jsonb,
  created_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.counselor_profile (
  id uuid not null default gen_random_uuid(),
  ghl_contact_uuid uuid,
  ghl_contact_id text,
  customer_email text,
  display_name text,
  disc counselor_disc,
  decision_driver counselor_driver,
  resistance counselor_resistance,
  trust_temp counselor_trust not null default 'guarded'::counselor_trust,
  confidence numeric(3,2) not null default 0.30,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.counselor_profile_snapshot (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  snapshot jsonb not null,
  reason text,
  created_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.counselor_resistance_event (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  issue text not null,
  pattern counselor_resistance,
  detail text,
  created_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.counselor_session (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  issue text not null,
  the_point text not null,
  stakes counselor_stakes not null default 'med'::counselor_stakes,
  framing_used text,
  level_used integer not null default 0,
  message_sent text,
  owner_response text,
  outcome counselor_outcome not null default 'unknown'::counselor_outcome,
  operator_email text,
  created_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.credit_billing_plans (
  id uuid not null default gen_random_uuid(),
  enrollment_id uuid not null,
  journey_id uuid not null,
  credit_path credit_path not null,
  status credit_plan_status not null default 'active'::credit_plan_status,
  is_add_on boolean not null default false,
  delivery_mode delivery_mode not null default 'self_guided_training'::delivery_mode,
  amount_cents integer not null default 0,
  monthly_fee_cents integer,
  down_paid_cents integer default 0,
  balance_due_cents integer default 0,
  next_billing_at timestamp with time zone,
  due_at timestamp with time zone,
  paid_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.credit_education_acknowledgments (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  section_id text not null,
  acknowledged_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.credit_education_sections (
  id text not null,
  title text not null,
  body_md text not null,
  sort_order smallint not null default 0,
  required boolean not null default true,
  active boolean not null default true
);

create table if not exists public.credit_enrollments (
  id uuid not null default gen_random_uuid(),
  journey_id uuid not null,
  profile_id uuid,
  customer_email text not null,
  case_id uuid,
  status text not null default 'active'::text,
  delivery_mode delivery_mode not null default 'self_guided_training'::delivery_mode,
  enrolled_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.credit_funding_sessions (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  first_name text,
  preferred_channel text,
  goals_horizon text,
  personal_vs_business_focus text,
  top_friction text,
  entity_type text,
  years_in_business integer,
  revenue_range text,
  team_size text,
  industry text,
  funding_goal_type text,
  prior_funding_history text,
  time_horizon text,
  readiness_indicators jsonb not null default '[]'::jsonb,
  awareness_level text,
  self_reported_score_range text,
  existing_challenges jsonb not null default '[]'::jsonb,
  prior_education_or_program text,
  banking_status text,
  entity_standing text,
  web_presence text,
  bookkeeping text,
  documentation text,
  score_business_foundation integer default 0,
  score_banking_readiness integer default 0,
  score_financial_organization integer default 0,
  score_credit_awareness integer default 0,
  score_revenue_stability integer default 0,
  score_funding_readiness integer default 0,
  score_total integer default (((((COALESCE(score_business_foundation, 0) + COALESCE(score_banking_readiness, 0)) + COALESCE(score_financial_organization, 0)) + COALESCE(score_credit_awareness, 0)) + COALESCE(score_revenue_stability, 0)) + COALESCE(score_funding_readiness, 0)),
  recommended_actions jsonb not null default '[]'::jsonb,
  ai_disclaimer_shown boolean not null default false,
  credit_guidance_disclaimer_linked boolean not null default false,
  no_outcome_promised boolean not null default true,
  banned_terms_check_passed boolean not null default true,
  session_id text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  stage_reached integer,
  channel text,
  operator_handoff_requested boolean not null default false,
  routing_tier text,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid),
  affiliate_ref text
);

create table if not exists public.credit_payment_schedule (
  id uuid not null default gen_random_uuid(),
  plan_id uuid not null,
  installment_no smallint not null default 1,
  amount_cents integer not null,
  due_at timestamp with time zone not null,
  paid_at timestamp with time zone,
  ledger_id uuid,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.credit_product_catalog (
  slug text not null,
  credit_path credit_path not null,
  title text not null,
  description text,
  amount_cents integer not null default 0,
  ghl_product_id text,
  ghl_tag text,
  active boolean not null default true
);

create table if not exists public.crm_sync_records (
  id uuid not null default gen_random_uuid(),
  business_line text not null default 'rentals'::text,
  ghl_contact_id text not null,
  ghl_opportunity_id text,
  ghl_pipeline_id text,
  ghl_pipeline_name text,
  ghl_stage text not null,
  ghl_previous_stage text,
  canonical_stage canonical_renter_stage not null default 'inquiry'::canonical_renter_stage,
  sync_status sync_record_status not null default 'pending_airtable'::sync_record_status,
  airtable_table text,
  airtable_record_id text,
  case_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  payload jsonb not null default '{}'::jsonb,
  verified_at timestamp with time zone,
  verified_by text,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.customer_inspection_photos (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  full_name text,
  vehicle_name text,
  vehicle_photos jsonb,
  odometer_reading numeric,
  date_time timestamp with time zone,
  interion_clean boolean,
  i_confirm_that_the_above_photos_and_details_accurately_reflect_ boolean,
  created_by text,
  exterior_clean boolean,
  record text,
  interior_clean boolean,
  confirmation boolean,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.customer_intake_forms (
  id uuid not null default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  request_type text not null default 'other'::text,
  subject text not null,
  details text,
  source text not null default 'web'::text,
  airtable_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  business_line text
);

create table if not exists public.customer_payments (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  customer text,
  customer_phone_number text,
  payment_method text,
  last_payment_date date,
  amount numeric,
  next_payment_due_date date,
  notes text,
  payment_status text,
  past_due_dates text,
  amout_past_due text,
  payment_plan text,
  invoice_receipt_attachment jsonb,
  payment_id text,
  customer_name text,
  vehicle text,
  vehicle_name text,
  incoming_lead_id uuid,
  product_code text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.customer_payments_snapshot_20260706 (
  id uuid,
  airtable_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  customer text,
  customer_phone_number text,
  payment_method text,
  last_payment_date date,
  amount numeric,
  next_payment_due_date date,
  notes text,
  payment_status text,
  past_due_dates text,
  amout_past_due text,
  payment_plan text,
  invoice_receipt_attachment jsonb,
  payment_id text,
  customer_name text,
  vehicle text,
  vehicle_name text,
  incoming_lead_id uuid,
  product_code text,
  org_id uuid
);

create table if not exists public.customer_services (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  entity_id uuid,
  customer_name text,
  contact_phone text,
  contact_email text,
  service_slug text not null,
  service_name text,
  tier text,
  status text not null default 'active'::text,
  channel text,
  opted_in_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.customer_vehicles (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid,
  customer_id uuid,
  customer text,
  make text,
  model text,
  year integer,
  color text,
  plate text,
  vin text,
  paint_condition text,
  coating_status text,
  coating_date date,
  interior_notes text,
  next_service_due date,
  photos jsonb,
  notes text
);

create table if not exists public.deal_payments (
  id uuid not null default gen_random_uuid(),
  deal_id uuid not null,
  amount numeric(12,2) not null,
  paid_at timestamp with time zone not null default now(),
  method text not null default 'cash'::text,
  reference text,
  notes text,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.dealer_applications (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  dealership_name text not null,
  owner_name text not null,
  phone text not null,
  email text,
  city_state text,
  licensed_dealer boolean not null default false,
  has_real_lot boolean not null default false,
  plays_fair boolean not null default false,
  mission_accepted boolean not null default false,
  confidentiality_agreed boolean not null default false,
  license_number text,
  years_in_business text,
  units_on_lot text,
  biggest_struggle text,
  interested_tier text,
  qualifies boolean not null default false,
  device text,
  source text,
  status text not null default 'New Application'::text
);

create table if not exists public.deals (
  id uuid not null default gen_random_uuid(),
  ref_code text not null default ('D-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8))),
  organization_id uuid not null,
  party_id uuid,
  fleet_vehicle_id uuid,
  vehicle_label text,
  vin text,
  status deal_status not null default 'working'::deal_status,
  sale_price numeric(12,2),
  trade_in_value numeric(12,2) default 0,
  down_payment numeric(12,2) default 0,
  notes text,
  case_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  closed_at timestamp with time zone,
  next_payment_due date,
  payment_schedule_cents integer,
  incoming_lead_id uuid,
  enrollment_payment_id uuid,
  funding_partner text,
  funded_at timestamp with time zone,
  funded_amount_cents bigint,
  referral_fee_cents bigint
);

create table if not exists public.detail_jobs (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid,
  job_date date,
  customer_id uuid,
  customer text,
  customer_vehicle_id uuid,
  fleet_vehicle_id uuid,
  is_internal boolean not null default false,
  services text,
  products_used text,
  price numeric,
  internal_cost numeric,
  before_photos jsonb,
  after_photos jsonb,
  next_service_due date,
  status text default 'scheduled'::text,
  notes text
);

create table if not exists public.detail_memberships (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid,
  customer_id uuid,
  customer text,
  tier text,
  monthly_price numeric,
  included_services text,
  status text default 'active'::text,
  start_date date,
  renewal_date date,
  notes text
);

create table if not exists public.dispute_clients (
  id text not null,
  client_name text,
  email text,
  source text not null,
  external_id text,
  payload jsonb not null,
  imported_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.do_not_contact_numbers (
  phone10 text not null,
  reason text,
  added_at timestamp with time zone not null default now()
);

create table if not exists public.do_not_rent_list (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  person_entity_name text,
  contact_email text,
  contact_phone text,
  driver_s_license jsonb,
  reason_for_restriction text,
  date_added date,
  source_of_restriction text,
  notes text,
  alert_category_ai text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.documents (
  id uuid not null default gen_random_uuid(),
  case_id uuid,
  kind text not null default 'general'::text,
  title text,
  storage_path text not null default ''::text,
  visibility text not null default 'internal'::text,
  uploaded_by uuid,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.employee_access_rights (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  employee_name text,
  employee_email text,
  tool_software text,
  access_level text,
  date_granted date,
  date_revoked date,
  website_access text[],
  active_access text,
  access_requested_by text,
  notes text
);

create table if not exists public.enforcement_settings (
  id boolean not null default true,
  mode text not null default 'shadow'::text,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.entitlements (
  slug text not null,
  name text not null,
  category text not null default 'app'::text,
  description text,
  portal text not null default 'client'::text,
  active boolean not null default true
);

create table if not exists public.exec_va_tasks (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  sweep_date date not null default CURRENT_DATE,
  category text not null,
  priority text not null default 'medium'::text,
  agent text not null default 'CHUMMO'::text,
  subject_name text,
  subject_phone text,
  subject_email text,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'pending'::text,
  result jsonb,
  handled_at timestamp with time zone
);

create table if not exists public.expenses (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  vehicle_name text,
  vehicle text,
  expense_date date,
  expense_type text,
  amount numeric,
  vendor_payee text,
  rental_vehicle text,
  description text,
  attachments jsonb,
  assignee text,
  status text,
  partner_name text,
  customer text,
  notes text,
  operations_management text,
  insurance text,
  tickets text,
  from_field_vendor_payee text,
  vehicle_maintenance_records text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.fleet (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  vehicle_name text,
  partner_name text,
  vehicle_status text,
  year numeric,
  vehicle_make text,
  vehicle_model text,
  color text,
  vehicle_pictures jsonb,
  finance_status text,
  weekly_prices text[],
  lowest_possible_price numeric,
  customer text,
  vin text,
  license_plate text,
  mileage numeric,
  type text,
  last_maintenance_date date,
  notes text,
  vehicle_maintenance_records text,
  vehicle_expenses text,
  insurance text,
  tickets text,
  registration jsonb,
  car_inspection_photos jsonb,
  vehicle_emissions_inspections jsonb,
  partner_percentage numeric,
  background_checks text,
  active_customers text,
  car_inspections text,
  customer_inspection_photos text,
  contracts text,
  vehicle_handover text,
  maintenance_appointments text,
  vehicle_onboarding_inspections text,
  expenses text,
  social_media_posts text,
  customers_copy text,
  records_nested text,
  from_field_records_nested text,
  partner_portal_notes text,
  vehicle_class text,
  capability_tags text[] not null default '{}'::text[],
  acquisition_cost numeric(12,2),
  list_price numeric(12,2),
  retail_status text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.fleet_car_inspections (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  inspection_name text,
  date_of_inspection date,
  inspector_name text,
  fleet_vehicle text,
  odometer_reading_at_inspection numeric,
  inspection_attachments jsonb,
  inspection_notes text,
  inspection_status text,
  customer_if_applicable text,
  next_scheduled_inspection date,
  is_followup_needed text,
  related_maintenance_record text,
  customer_inspection_photos text,
  inspection_type text,
  status text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.form_submissions (
  id uuid not null default gen_random_uuid(),
  person_id uuid,
  form_slug text not null,
  tenant_slug text not null default 'aixmos'::text,
  site text not null,
  destination_table text,
  destination_id uuid,
  payload jsonb not null default '{}'::jsonb,
  landing_url text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.former_customers (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  customer_name text,
  contact_email text,
  contact_phone text,
  rental_start_date date,
  rental_end_date date,
  vehicle_rented text,
  license_plate text,
  vin text,
  reason_for_removal text,
  future_upsell_opportunities_ai text,
  last_payment_date date,
  contracts text,
  customer_payments text,
  notes text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.garage_builds (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  subtitle text not null,
  driver_name text not null,
  price_cents integer not null,
  earned_cents integer not null default 0,
  whp integer not null,
  wtq integer not null,
  zero_sixty text not null,
  fuel text not null,
  specs jsonb not null default '[]'::jsonb,
  chain_hash text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.garage_gates (
  id uuid not null default gen_random_uuid(),
  build_id uuid not null,
  label text not null,
  description text not null,
  passed boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.garage_history (
  id uuid not null default gen_random_uuid(),
  build_id uuid not null,
  event_date text not null,
  title text not null,
  summary text not null,
  sort_order integer not null default 0
);

create table if not exists public.garage_ledger (
  id uuid not null default gen_random_uuid(),
  build_id uuid not null,
  entry_date text not null,
  entry_type text not null,
  amount_cents integer not null,
  hash_ok boolean not null default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.garage_mods (
  id uuid not null default gen_random_uuid(),
  build_id uuid not null,
  category text not null,
  description text not null,
  sort_order integer not null default 0
);

create table if not exists public.ghl_appointments (
  id uuid not null default gen_random_uuid(),
  ghl_appointment_id text not null,
  ghl_contact_id text,
  title text,
  status text,
  calendar_id text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  timezone text,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.ghl_contacts (
  id uuid not null default gen_random_uuid(),
  ghl_contact_id text not null,
  full_name text,
  email text,
  phone text,
  tags text[] not null default '{}'::text[],
  location_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.ghl_form_submissions (
  id uuid not null default gen_random_uuid(),
  ghl_submission_id text,
  ghl_contact_id text,
  form_id text,
  form_name text,
  fields jsonb not null default '{}'::jsonb,
  source text not null default 'ghl'::text,
  intake_id uuid,
  case_id uuid,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.hailmary_licenses (
  id uuid not null default gen_random_uuid(),
  license_id uuid not null default gen_random_uuid(),
  operator_name text not null,
  operator_email text not null,
  operator_phone text,
  operator_city text,
  tier text not null,
  device_fingerprint text not null,
  activated_at timestamp with time zone not null default now(),
  last_heartbeat timestamp with time zone,
  active boolean not null default true,
  paid_in_full boolean not null default false,
  revoked_at timestamp with time zone,
  revoke_reason text,
  heartbeat_interval_days integer not null default 7,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.incident_assignments (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  incident_id uuid not null,
  unit_id uuid not null,
  assigned_by_kind text not null,
  assigned_by uuid,
  override_weight numeric not null default 0,
  reasoning_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  locked_at timestamp with time zone
);

create table if not exists public.incidents (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  ref_code text,
  reported_at timestamp with time zone not null default now(),
  reporter_name text,
  reporter_phone text,
  location_lat double precision,
  location_lng double precision,
  location_text text,
  description text,
  severity smallint,
  required_capabilities text[] not null default '{}'::text[],
  required_class text,
  status text not null default 'received'::text,
  created_by uuid,
  closed_at timestamp with time zone
);

create table if not exists public.incoming_leads (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  contact_name text,
  opportunity_name text,
  phone numeric,
  email text,
  priority_level text,
  created_on timestamp with time zone,
  status text,
  notes text,
  fleet text,
  car_inspections text,
  updated_on timestamp with time zone,
  last_modified_time timestamp with time zone,
  lead_verification text,
  waitlist text,
  do_not_rent_list text,
  background_checks text,
  rating text,
  phone_text text,
  source text,
  source_campaign text,
  source_medium text,
  referrer_url text,
  landing_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referred_by_lead_id uuid,
  organization_id uuid,
  phone_e164 text,
  sku text,
  sku_price_cents integer,
  agent_status text not null default 'NEW'::text,
  qualification jsonb not null default '{}'::jsonb,
  conversation_id uuid,
  stripe_payment_intent_id text,
  opted_out boolean not null default false,
  opted_out_at timestamp with time zone,
  contacted_at timestamp with time zone,
  qualified_at timestamp with time zone,
  closed_at timestamp with time zone,
  lost_at timestamp with time zone,
  assigned_to uuid,
  assigned_at timestamp with time zone,
  assignment_source text,
  affiliate_code text,
  affiliate_operator_id uuid,
  lane text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid),
  program text,
  source_confidence text
);

create table if not exists public.installations (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  hardware_uuid text,
  tier text not null default 'full_install_50k'::text,
  status text not null default 'locked'::text,
  paid_at timestamp with time zone,
  setup_completed_at timestamp with time zone,
  comprehension_passed_at timestamp with time zone,
  activated_at timestamp with time zone,
  license_key text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.insurance (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  insured_vehicle text,
  insured_customer text,
  insured_entity_type text,
  insurance_company_name text,
  policy_number text,
  login_email text,
  login_password text,
  login_phone text,
  insurance_due_date text,
  insurance_payment_amount text,
  personal_insurance_policy text,
  policy_type text,
  coverage_amount numeric,
  deductible numeric,
  policy_start_date date,
  policy_end_date date,
  insurance_status text,
  proof_of_insurance_attachment jsonb,
  notes text,
  related_expenses text,
  renewal_reminder_date date,
  commercial_insurance_policy_number jsonb,
  tickets text,
  insured_customer_link text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.intake_events (
  id bigint generated always as identity not null,
  source text not null,
  record_id text,
  haystack text,
  payload jsonb,
  program text,
  confidence text,
  matched_on text,
  routed_at timestamp with time zone,
  routed_action text,
  note text,
  org_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.job_dispatch_deliveries (
  id uuid not null default gen_random_uuid(),
  case_id uuid not null,
  vendor_job_id uuid,
  partner_app_slug text not null,
  endpoint_id uuid,
  status job_delivery_status not null default 'pending'::job_delivery_status,
  payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body text,
  delivered_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.journey_checkpoint_events (
  id uuid not null default gen_random_uuid(),
  journey_id uuid not null,
  checkpoint_slug text not null,
  met_at timestamp with time zone not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.journey_checkpoints (
  slug text not null,
  title text not null,
  description text,
  sort_order smallint not null default 0,
  active boolean not null default true,
  organization_id uuid not null default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

create table if not exists public.lead_followups (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  lead_id uuid not null,
  organization_id uuid,
  due_at timestamp with time zone not null,
  status text not null default 'open'::text,
  escalated_at timestamp with time zone,
  resolved_at timestamp with time zone,
  note text
);

create table if not exists public.leadnet_config (
  id boolean not null default true,
  slack_webhook_url text,
  sla_minutes integer not null default 60,
  digest_enabled boolean not null default true,
  sweep_enabled boolean not null default true,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.lto_agreements (
  id uuid not null default gen_random_uuid(),
  journey_id uuid not null,
  vehicle_id uuid,
  vin text,
  weekly_buyout_cents integer,
  term_weeks integer,
  status text not null default 'draft'::text,
  signed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.maintenance_appointments (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  maintenance_appointment_id bigint,
  fleet_vehicle text,
  active_customer_if_applicable text,
  appointment_date_time timestamp with time zone,
  maintenance_type text,
  assigned_staff text,
  status text,
  service_provider_location text,
  notes text,
  fee_assessed_if_no_show_late numeric,
  was_customer_notified_of_fee boolean,
  appointment_date date,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.marketing_kpi_weeks (
  week_start date not null,
  followers integer not null default 0,
  reel_views integer not null default 0,
  story_views integer not null default 0,
  dm_started integer not null default 0,
  calls_booked integer not null default 0,
  new_subscribers integer not null default 0,
  email_list_growth integer not null default 0,
  notes text,
  submitted_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  ghl_synced_at timestamp with time zone,
  ghl_auto jsonb not null default '{}'::jsonb,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.marketplace_listings (
  id uuid not null default gen_random_uuid(),
  vertical_slug text not null default 'tmmt_rentals'::text,
  listing_type marketplace_listing_type not null default 'deal'::marketplace_listing_type,
  title text not null,
  description text,
  financial_summary text,
  external_url text,
  featured boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.memory_entities (
  id uuid not null default gen_random_uuid(),
  kind text not null default 'other'::text,
  display_name text not null,
  org_id uuid,
  external_refs jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.memory_events (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  actor_kind text not null,
  actor_id uuid,
  actor_label text,
  source text not null default 'app'::text,
  action text not null,
  entity_id uuid,
  summary text,
  details jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  dedupe_key text,
  occurred_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  embedding_local vector(768)
);

create table if not exists public.memory_facts (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  entity_id uuid,
  fact text not null,
  confidence real not null default 0.8,
  visibility text not null default 'org'::text,
  source_event uuid,
  embedding vector(1536),
  valid_from timestamp with time zone not null default now(),
  valid_to timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  embedding_local vector(768)
);

create table if not exists public.mesh_nodes (
  node_id text not null,
  operator text not null,
  tier text not null default 'TASTE'::text,
  device_hash text,
  tailscale_ip text,
  registered_at timestamp with time zone not null default now(),
  last_heartbeat timestamp with time zone,
  status text not null default 'LIVE'::text,
  modules_done integer not null default 0,
  total_paid numeric(12,2) not null default 0,
  pass_down_ready boolean not null default false,
  kill_tier integer not null default 0,
  watchtower_ip text,
  brainiac_mac_host text,
  brainiac_win_ip text,
  aria_version text,
  notes text
);

create table if not exists public.mission_items (
  id uuid not null default gen_random_uuid(),
  profile_id uuid,
  view text not null,
  kind text not null default 'needed'::text,
  icon text,
  title text not null,
  detail text,
  agent text,
  priority integer not null default 0,
  status text not null default 'draft'::text,
  source text not null default 'agent'::text,
  created_by uuid,
  approved_by uuid,
  published_at timestamp with time zone,
  expires_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.money_meter_accounts (
  org_id uuid not null,
  free_forever boolean not null default false,
  label text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.money_meter_events (
  id bigint generated always as identity not null,
  org_id uuid,
  direction text not null,
  category text not null,
  amount_usd numeric(14,4) not null,
  billable boolean not null default true,
  source text,
  ref text,
  dedupe_key text,
  meta jsonb,
  occurred_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.operation_costs (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  tool_software_name text,
  type text,
  description text,
  category text[],
  license_subscription_status text,
  prices numeric,
  employee_access_rights text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.operator_pipeline_tracker (
  id uuid not null default gen_random_uuid(),
  operator_name text not null,
  operator_email text,
  pipeline_stage text not null default 'Enrolled'::text,
  current_module_number smallint default 1,
  action_step_complete boolean default false,
  credit_score_current smallint,
  credit_score_target smallint default 650,
  vehicle_assigned text,
  vehicle_status text default 'TBD'::text,
  enrolled_at timestamp with time zone default now(),
  last_checkin_at timestamp with time zone,
  next_checkin_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.operator_profiles (
  id uuid not null default gen_random_uuid(),
  journey_id uuid,
  profile_id uuid,
  customer_email text not null,
  level operator_level not null default 'candidate'::operator_level,
  rubric_score smallint not null default 0,
  revenue_share_pct smallint not null default 35,
  license_fee_cents integer not null default 0,
  ghl_pipeline_stage text,
  certified_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.operator_rubric_scores (
  id uuid not null default gen_random_uuid(),
  operator_id uuid not null,
  period_month date not null,
  category_scores jsonb not null default '{}'::jsonb,
  total_score smallint not null default 0,
  scored_by uuid,
  notes text,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.operator_training_modules (
  id uuid not null default gen_random_uuid(),
  track text not null default 'core'::text,
  slug text not null,
  title text not null,
  objective text,
  drill text,
  pass_criteria text,
  content_md text,
  est_minutes smallint default 45,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.operator_training_progress (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  module_id uuid not null,
  percent_complete smallint not null default 0,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.operator_va_assignments (
  id uuid not null default gen_random_uuid(),
  operator_id uuid not null,
  va_profile_id uuid not null,
  role text default 'support'::text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.org_responder_links (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  link_kind text not null,
  approved_at timestamp with time zone,
  approved_by uuid,
  certs jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table if not exists public.org_roles (
  org_id uuid not null,
  user_id uuid not null,
  role text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.organization_domains (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  hostname text not null,
  is_primary boolean not null default false,
  verified_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.organization_licenses (
  organization_id uuid not null,
  license_tier license_tier not null default 'rentals_app'::license_tier,
  modules text[] not null default '{}'::text[],
  max_ventures integer not null default 1,
  license_key_hash text,
  valid_until timestamp with time zone,
  provisioned_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  active boolean not null default true,
  kill_command text,
  hardware_uuid text,
  enclave_pubkey_pem text,
  install_token_hash text,
  install_token_used boolean not null default false,
  last_heartbeat_at timestamp with time zone,
  internal_protected boolean not null default false
);

create table if not exists public.organizations (
  id uuid not null default gen_random_uuid(),
  name text not null,
  kind text not null default 'tmmt'::text,
  airtable_id text,
  created_at timestamp with time zone not null default now(),
  vertical org_vertical not null default 'rental'::org_vertical,
  parent_agency_id uuid,
  plan_tier text not null default 'starter'::text,
  billing_status text not null default 'trialing'::text,
  stripe_customer_id text,
  stripe_subscription_id text,
  suspended_at timestamp with time zone,
  onboarding_step text default 'not_started'::text,
  onboarding_completed_at timestamp with time zone,
  stripe_connect_account_id text,
  connect_charges_enabled boolean not null default false,
  agency_revenue_share_pct smallint not null default 80,
  partner_client_segment partner_client_segment,
  partner_revenue_split_tier partner_revenue_split_tier,
  partner_has_startup_capital boolean not null default false,
  partner_qualified_vehicle_count integer not null default 0,
  partner_split_auto_track boolean not null default true,
  partner_has_own_system boolean not null default false,
  partner_app_slug text,
  twilio_inbound_number text,
  agent_name text default 'Riley'::text,
  agent_persona_overlay jsonb not null default '{}'::jsonb,
  handoff_slack_webhook text,
  handoff_imessage_target text,
  cal_com_event_link text,
  llm_daily_cap_usd numeric not null default 50
);

create table if not exists public.outreach_touches (
  id uuid not null default gen_random_uuid(),
  lead_id uuid not null,
  operator_id uuid,
  channel text not null,
  direction text not null default 'outbound'::text,
  lane text,
  template_key text,
  body text,
  outcome text,
  provider_id text,
  approved_by text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.package_entitlements (
  package_id uuid not null,
  entitlement_slug text not null
);

create table if not exists public.packages (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  tier smallint not null default 1,
  description text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  price_cents integer,
  price_max_cents integer,
  currency text not null default 'USD'::text
);

create table if not exists public.parties (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  full_name text not null,
  email text,
  phone text,
  party_type text not null default 'buyer'::text,
  lead_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.partner_app_endpoints (
  id uuid not null default gen_random_uuid(),
  partner_app_slug text not null,
  webhook_url text not null,
  webhook_secret text,
  work_types text[] not null default '{}'::text[],
  case_types text[] not null default '{}'::text[],
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.partner_fleet_access (
  id uuid not null default gen_random_uuid(),
  partner_user_id uuid not null,
  fleet_id uuid not null,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.partner_referrals (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  source_org text not null,
  dest_org text not null,
  source_contact_ref text,
  reason text,
  consent_captured_at timestamp with time zone,
  consent_channel text,
  status text default 'pending'::text,
  commission_cents integer,
  handoff_event_id text,
  notes text,
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  paid_at timestamp with time zone,
  source_operator_id uuid,
  affiliate_user_id uuid,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.partners (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  email text not null,
  type text default 'affiliate'::text,
  ghl_tag text,
  active boolean default true,
  created_at timestamp with time zone default now(),
  priority smallint not null default 100,
  notes text
);

create table if not exists public.payments (
  id uuid not null default gen_random_uuid(),
  booking_id uuid,
  case_id uuid,
  profile_id uuid,
  amount_cents integer not null,
  currency text not null default 'usd'::text,
  status text not null default 'pending'::text,
  provider text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.people (
  id uuid not null default gen_random_uuid(),
  full_name text,
  email text,
  phone_e164 text,
  phone_digits text,
  source_first text,
  source_last text,
  tenant_slug text not null default 'aixmos'::text,
  ghl_contact_id text,
  incoming_lead_id uuid,
  active_customer_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.portal_clients (
  id uuid not null default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  phone text,
  ghl_contact_id text,
  score_range text,
  credit_goal text,
  halal_preference boolean default false,
  stage text default 'intake'::text,
  source text,
  referred_by text,
  advisor_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  partner_slug text,
  submitted_by text
);

create table if not exists public.profile_entitlement_grants (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  entitlement_slug text not null,
  granted_by uuid,
  note text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.profiles (
  id uuid not null,
  email text,
  full_name text,
  phone text,
  role user_role not null default 'customer'::user_role,
  organization_id uuid,
  airtable_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  portal_role portal_role not null default 'client'::portal_role,
  admin_scope admin_scope,
  team_department team_department,
  package_id uuid,
  respond_capable boolean not null default false,
  responder_certs jsonb,
  telegram_chat_id text,
  is_certified boolean not null default false,
  affiliate_code text,
  unlock_status text
);

create table if not exists public.program_applications (
  id uuid not null default gen_random_uuid(),
  access_token uuid not null default gen_random_uuid(),
  ghl_contact_id text,
  email text not null,
  client_name text not null default ''::text,
  track program_funding_track not null default 'personal'::program_funding_track,
  status program_application_status not null default 'onboarding'::program_application_status,
  payload jsonb not null default '{}'::jsonb,
  overall_readiness integer not null default 0,
  client_consent_given boolean not null default false,
  consent_timestamp timestamp with time zone,
  submission_method text,
  submission_reference text,
  source text default 'manual'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.program_audit_log (
  id uuid not null default gen_random_uuid(),
  application_id uuid not null,
  actor_name text not null default 'System'::text,
  actor_role text not null default 'admin'::text,
  action text not null,
  from_status program_application_status,
  to_status program_application_status,
  notes text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.program_documents (
  id uuid not null default gen_random_uuid(),
  application_id uuid not null,
  doc_key text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  verified_at timestamp with time zone,
  verified_by uuid,
  uploaded_by uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.programs (
  slug text not null,
  name text not null,
  vertical text,
  match_keywords text[] not null default '{}'::text[],
  priority integer not null default 100,
  destination text,
  owner_role text,
  next_action text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  lane text
);

create table if not exists public.protocol_runs (
  id uuid not null default gen_random_uuid(),
  case_id uuid not null,
  vendor_job_id uuid,
  protocol_id text not null,
  status protocol_run_status not null default 'pending'::protocol_run_status,
  steps jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.rental_insurance_products (
  id uuid not null default gen_random_uuid(),
  tier vehicle_tier not null,
  coverage_source insurance_coverage_source not null,
  name text not null,
  weekly_premium_cents integer not null default 0,
  min_liability_cents integer,
  requires_background_approved boolean not null default true,
  corporate_carrier_name text,
  corporate_policy_template text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.rental_insurance_selections (
  id uuid not null default gen_random_uuid(),
  booking_id uuid not null,
  profile_id uuid,
  customer_email text not null,
  coverage_source insurance_coverage_source not null default 'pending'::insurance_coverage_source,
  policy_number text,
  carrier_name text,
  weekly_premium_cents integer not null default 0,
  risk_score smallint,
  background_check_status text,
  proof_document_path text,
  corporate_policy_id text,
  verified_at timestamp with time zone,
  verified_by uuid,
  lot_release_approved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.rental_ledger (
  id uuid not null default gen_random_uuid(),
  profile_id uuid,
  customer_email text not null,
  booking_id uuid,
  case_id uuid,
  entry_type ledger_entry_type not null,
  status ledger_entry_status not null default 'pending'::ledger_entry_status,
  title text not null,
  description text,
  amount_cents integer not null default 0,
  currency text not null default 'usd'::text,
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid,
  source text not null default 'team'::text,
  organization_id uuid,
  customer_name text,
  visible_to_client boolean not null default true
);

create table if not exists public.rental_pricing_rules (
  id uuid not null default gen_random_uuid(),
  tier vehicle_tier not null,
  make text,
  model text,
  year_min smallint,
  year_max smallint,
  daily_rate_cents integer not null,
  weekly_rate_cents integer not null,
  deposit_cents integer not null default 50000,
  match_priority smallint not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.revenue_splits (
  id uuid not null default gen_random_uuid(),
  operator_id uuid,
  period_start date not null,
  period_end date not null,
  gross_cents integer not null default 0,
  platform_cents integer not null default 0,
  operator_cents integer not null default 0,
  status text not null default 'pending'::text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  organization_id uuid,
  partner_cents integer,
  agency_cents integer,
  partner_pct smallint,
  agency_pct smallint,
  split_tier partner_revenue_split_tier,
  split_segment partner_client_segment,
  deal_id uuid
);

create table if not exists public.rewards (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  points integer not null default 0,
  source text not null,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.routing_candidates (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  candidate_kind text not null,
  ref_kind text,
  ref_id text,
  display_name text not null,
  capability_tags text[] not null default '{}'::text[],
  vertical_slugs text[] not null default '{}'::text[],
  status text not null default 'available'::text,
  max_concurrent integer not null default 3,
  current_load integer not null default 0,
  priority_weight numeric not null default 0,
  contact_phone text,
  contact_email text,
  location_lat double precision,
  location_lng double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.services (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  category text not null default 'rental'::text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.shops_mechanics_cleaning (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  vendor_payee text,
  phone_number text,
  email_address text,
  point_of_contact text,
  notes text,
  attachment_summary text,
  expenses text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.signup_invites (
  id uuid not null default gen_random_uuid(),
  code_hash text not null,
  label text,
  email text,
  expires_at timestamp with time zone not null default (now() + '14 days'::interval),
  used_at timestamp with time zone,
  used_by uuid,
  created_at timestamp with time zone not null default now(),
  created_by text
);

create table if not exists public.sync_events (
  id uuid not null default gen_random_uuid(),
  source text not null,
  event_type text not null,
  external_id text,
  sync_record_id uuid,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  error text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.tasks (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text,
  status text default 'To Do'::text,
  priority text default 'Medium'::text,
  assigned_to text,
  due_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.team_onboarding (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  full_name text not null,
  role text not null default 'operator'::text,
  phone text,
  email text,
  owns text,
  skills text,
  first_step text,
  mission_accepted boolean not null default false,
  confidentiality_agreed boolean not null default false,
  device text,
  source text,
  status text not null default 'Pending Review'::text,
  affiliate_code text,
  auth_user_id uuid,
  provisioned_at timestamp with time zone,
  provision_error text,
  login_link text,
  login_link_sent_at timestamp with time zone
);

create table if not exists public.tickets (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  ticket_id bigint,
  requested_by_customer text,
  citation text,
  related_vehicle text,
  attachments_screenshots_docs_photos jsonb,
  description_issue_details text,
  status text,
  priority text,
  amount numeric,
  violation_type text,
  date_created date,
  follow_up_date date,
  internal_notes text,
  date_closed date,
  created_by text,
  if_selected_others_specify_violation_type text,
  customer_linked text,
  ticket_balance_status text,
  total_customer_ticket_balance text,
  phone text,
  vehicle_description text,
  issue_type text,
  urgency text,
  description text,
  location text,
  customer_name text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.time_clock_entries (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  user_email text,
  clock_in timestamp with time zone not null default now(),
  clock_out timestamp with time zone,
  note text,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.tmmt_token_balances (
  org_id uuid not null,
  balance integer not null default 0,
  monthly_allotment integer not null default 0,
  plan_tier text not null default 'none'::text,
  unlimited boolean not null default false,
  status text not null default 'active'::text,
  last_topup_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.tmmt_token_events (
  id bigint generated always as identity not null,
  org_id uuid not null,
  delta integer not null,
  reason text not null,
  dedupe_key text,
  job_ref text,
  balance_after integer,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.tmmt_token_ledger (
  id bigint generated always as identity not null,
  event text not null,
  device_id text not null,
  tier text,
  tokens integer,
  code_hash text,
  note text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.training_module_progress (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  module_id uuid not null,
  percent_complete smallint not null default 0,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.training_modules (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  title text not null,
  summary text,
  content_md text,
  sort_order smallint not null default 0,
  is_core boolean not null default true,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.unit_locations (
  id bigint generated always as identity not null,
  org_id uuid not null,
  unit_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  heading smallint,
  speed_mph smallint,
  recorded_at timestamp with time zone not null default now()
);

create table if not exists public.units (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  fleet_id uuid,
  responder_id uuid,
  callsign text not null,
  status text not null default 'off_duty'::text,
  current_lat double precision,
  current_lng double precision,
  last_ping_at timestamp with time zone,
  active_assignment_id uuid,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.vehicle_damage_reports (
  id uuid not null default gen_random_uuid(),
  case_id uuid,
  booking_id uuid,
  vehicle_id uuid,
  customer_email text not null,
  title text not null,
  description text,
  severity damage_severity not null default 'minor'::damage_severity,
  status damage_status not null default 'reported'::damage_status,
  visible_to_client boolean not null default true,
  reported_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vehicle_events (
  id uuid not null default gen_random_uuid(),
  journey_id uuid,
  booking_id uuid,
  event_type vehicle_event_type not null,
  old_vehicle_id uuid,
  new_vehicle_id uuid,
  case_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vehicle_handover (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  handover_id bigint,
  contract text,
  active_customer text,
  fleet_vehicle text,
  handover_date timestamp with time zone,
  required_docs_provided boolean,
  document_verification_status text,
  handover_checklist_staff jsonb,
  customer_checklist_received_documents jsonb,
  notes text,
  handover_status text,
  inspection_documents_provided boolean,
  registration_documents_provided boolean,
  insurance_documents_provided boolean,
  handover_notes text,
  customer_name text,
  staff_name text,
  vehicle_make text,
  vehicle_model text,
  license_plate text,
  odometer_reading numeric,
  fuel_level text,
  check_exterior boolean,
  check_interior boolean,
  check_tires boolean,
  check_lights boolean,
  check_documents boolean,
  condition_notes text,
  customer_signature text,
  handover_type text,
  status text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vehicle_media (
  id uuid not null default gen_random_uuid(),
  case_id uuid,
  booking_id uuid,
  vehicle_id uuid,
  customer_email text not null,
  storage_path text not null,
  file_name text,
  caption text,
  media_type text not null default 'photo'::text,
  visible_to_client boolean not null default true,
  uploaded_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vehicle_onboarding_inspections (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  inspection_id bigint,
  inspection_date date,
  inspector_name text,
  fleet_vehicle text,
  mechanical_inspection_result text,
  mechanical_notes text,
  cleanliness_status text,
  cleanliness_notes text,
  tracker_installation_status text,
  tracker_install_notes text,
  keys_verification_status text,
  document_verification_status text,
  documents_uploaded jsonb,
  photos_condition_docs jsonb,
  general_notes text,
  inspection_status text,
  onboarding_checklist_completion numeric,
  flag_for_followup boolean,
  onboarding_stage text,
  ai_summary_next_steps text,
  ai_urgency_level text,
  cleaned_detailed_status text,
  cleaned_detailed_notes text,
  make text,
  model text,
  year text,
  vin text,
  license_plate text,
  color text,
  odometer numeric,
  overall_rating text,
  notes text,
  status text,
  tire_pressure_fl numeric,
  tire_pressure_fr numeric,
  tire_pressure_rl numeric,
  tire_pressure_rr numeric,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vehicles (
  id uuid not null default gen_random_uuid(),
  label text not null,
  make text,
  model text,
  year smallint,
  vin text,
  plate text,
  daily_rate numeric(10,2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  tier vehicle_tier,
  weekly_rate numeric(10,2),
  fleet_vehicle_id uuid,
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vendor_files (
  id uuid not null default gen_random_uuid(),
  vendor_job_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vendor_job_updates (
  id uuid not null default gen_random_uuid(),
  vendor_job_id uuid not null,
  status text not null,
  note text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vendor_jobs (
  id uuid not null default gen_random_uuid(),
  case_id uuid not null,
  vendor_id uuid not null,
  title text not null,
  description text,
  status text not null default 'offered'::text,
  offered_at timestamp with time zone not null default now(),
  accepted_at timestamp with time zone,
  scheduled_at timestamp with time zone,
  completed_at timestamp with time zone,
  internal_notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.vendors (
  id uuid not null default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  vendor_type text,
  auth_user_id uuid,
  shops_record_id uuid,
  active boolean not null default true,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  service_verticals text[] not null default '{}'::text[],
  agreement_status text not null default 'pending'::text
);

create table if not exists public.ventures (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  color text,
  logo_url text,
  status text not null default 'active'::text,
  pinned_widgets jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  org_id uuid default COALESCE(
CASE
    WHEN is_staff() THEN NULL::uuid
    ELSE acting_org_id()
END, '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.verticals (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  slug text not null,
  name text,
  capability_tags text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.waitlist (
  id uuid not null default gen_random_uuid(),
  airtable_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  customer_name text,
  linked_background_check text,
  customer_phone text,
  customer_email text,
  vehicle_type text,
  desired_specifications_notes text,
  status text,
  appointments text,
  desired_weekly_payment numeric,
  make text,
  model text,
  year numeric,
  date_added_to_waitlist date,
  desired_specs_notes text,
  org_id uuid default COALESCE(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid)
);

create table if not exists public.work_assignments (
  id uuid not null default gen_random_uuid(),
  case_id uuid,
  candidate_id uuid,
  assigned_by_kind text not null default 'system'::text,
  assigned_by uuid,
  score numeric,
  reasoning jsonb not null default '{}'::jsonb,
  status text not null default 'assigned'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  org_id uuid default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid
);

-- ============ 5. CONSTRAINTS ============
alter table public.active_customers add constraint active_customers_pkey PRIMARY KEY (id);
alter table public.affiliate_links add constraint affiliate_links_pkey PRIMARY KEY (id);
alter table public.agent_conversations add constraint agent_conversations_pkey PRIMARY KEY (id);
alter table public.agent_definitions add constraint agent_definitions_pkey PRIMARY KEY (id);
alter table public.agent_evaluation_sessions add constraint agent_evaluation_sessions_pkey PRIMARY KEY (id);
alter table public.agent_evaluations add constraint agent_evaluations_pkey PRIMARY KEY (id);
alter table public.agent_jobs add constraint agent_jobs_pkey PRIMARY KEY (id);
alter table public.agent_messages add constraint agent_messages_pkey PRIMARY KEY (id);
alter table public.appointments add constraint appointments_pkey PRIMARY KEY (id);
alter table public.assignment_overrides add constraint assignment_overrides_pkey PRIMARY KEY (id);
alter table public.audit_events add constraint audit_events_pkey PRIMARY KEY (id);
alter table public.automation_outbox add constraint automation_outbox_pkey PRIMARY KEY (id);
alter table public.background_checks add constraint background_checks_pkey PRIMARY KEY (id);
alter table public.bills add constraint bills_pkey PRIMARY KEY (id);
alter table public.bookings add constraint bookings_pkey PRIMARY KEY (id);
alter table public.case_client_updates add constraint case_client_updates_pkey PRIMARY KEY (id);
alter table public.case_status_history add constraint case_status_history_pkey PRIMARY KEY (id);
alter table public.cases add constraint cases_pkey PRIMARY KEY (id);
alter table public.clickup_tasks add constraint clickup_tasks_pkey PRIMARY KEY (id);
alter table public.client_alerts add constraint client_alerts_pkey PRIMARY KEY (id);
alter table public.client_journey add constraint client_journey_pkey PRIMARY KEY (id);
alter table public.client_updates add constraint client_updates_pkey PRIMARY KEY (id);
alter table public.comm_channels add constraint comm_channels_pkey PRIMARY KEY (id);
alter table public.contract_instances add constraint contract_instances_pkey PRIMARY KEY (id);
alter table public.contracts add constraint contracts_pkey PRIMARY KEY (id);
alter table public.coo_briefings add constraint coo_briefings_pkey PRIMARY KEY (id);
alter table public.counselor_escalation_state add constraint counselor_escalation_state_pkey PRIMARY KEY (id);
alter table public.counselor_interaction add constraint counselor_interaction_pkey PRIMARY KEY (id);
alter table public.counselor_profile add constraint counselor_profile_pkey PRIMARY KEY (id);
alter table public.counselor_profile_snapshot add constraint counselor_profile_snapshot_pkey PRIMARY KEY (id);
alter table public.counselor_resistance_event add constraint counselor_resistance_event_pkey PRIMARY KEY (id);
alter table public.counselor_session add constraint counselor_session_pkey PRIMARY KEY (id);
alter table public.credit_billing_plans add constraint credit_billing_plans_pkey PRIMARY KEY (id);
alter table public.credit_education_acknowledgments add constraint credit_education_acknowledgments_pkey PRIMARY KEY (id);
alter table public.credit_education_sections add constraint credit_education_sections_pkey PRIMARY KEY (id);
alter table public.credit_enrollments add constraint credit_enrollments_pkey PRIMARY KEY (id);
alter table public.credit_funding_sessions add constraint credit_funding_sessions_pkey PRIMARY KEY (id);
alter table public.credit_payment_schedule add constraint credit_payment_schedule_pkey PRIMARY KEY (id);
alter table public.credit_product_catalog add constraint credit_product_catalog_pkey PRIMARY KEY (slug);
alter table public.crm_sync_records add constraint crm_sync_records_pkey PRIMARY KEY (id);
alter table public.customer_inspection_photos add constraint customer_inspection_photos_pkey PRIMARY KEY (id);
alter table public.customer_intake_forms add constraint customer_intake_forms_pkey PRIMARY KEY (id);
alter table public.customer_payments add constraint customer_payments_pkey PRIMARY KEY (id);
alter table public.customer_services add constraint customer_services_pkey PRIMARY KEY (id);
alter table public.customer_vehicles add constraint customer_vehicles_pkey PRIMARY KEY (id);
alter table public.deal_payments add constraint deal_payments_pkey PRIMARY KEY (id);
alter table public.dealer_applications add constraint dealer_applications_pkey PRIMARY KEY (id);
alter table public.deals add constraint deals_pkey PRIMARY KEY (id);
alter table public.detail_jobs add constraint detail_jobs_pkey PRIMARY KEY (id);
alter table public.detail_memberships add constraint detail_memberships_pkey PRIMARY KEY (id);
alter table public.dispute_clients add constraint dispute_clients_pkey PRIMARY KEY (id);
alter table public.do_not_contact_numbers add constraint do_not_contact_numbers_pkey PRIMARY KEY (phone10);
alter table public.do_not_rent_list add constraint do_not_rent_list_pkey PRIMARY KEY (id);
alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
alter table public.employee_access_rights add constraint employee_access_rights_pkey PRIMARY KEY (id);
alter table public.enforcement_settings add constraint enforcement_settings_pkey PRIMARY KEY (id);
alter table public.entitlements add constraint entitlements_pkey PRIMARY KEY (slug);
alter table public.exec_va_tasks add constraint exec_va_tasks_pkey PRIMARY KEY (id);
alter table public.expenses add constraint expenses_pkey PRIMARY KEY (id);
alter table public.fleet add constraint fleet_pkey PRIMARY KEY (id);
alter table public.fleet_car_inspections add constraint fleet_car_inspections_pkey PRIMARY KEY (id);
alter table public.form_submissions add constraint form_submissions_pkey PRIMARY KEY (id);
alter table public.former_customers add constraint former_customers_pkey PRIMARY KEY (id);
alter table public.garage_builds add constraint garage_builds_pkey PRIMARY KEY (id);
alter table public.garage_gates add constraint garage_gates_pkey PRIMARY KEY (id);
alter table public.garage_history add constraint garage_history_pkey PRIMARY KEY (id);
alter table public.garage_ledger add constraint garage_ledger_pkey PRIMARY KEY (id);
alter table public.garage_mods add constraint garage_mods_pkey PRIMARY KEY (id);
alter table public.ghl_appointments add constraint ghl_appointments_pkey PRIMARY KEY (id);
alter table public.ghl_contacts add constraint ghl_contacts_pkey PRIMARY KEY (id);
alter table public.ghl_form_submissions add constraint ghl_form_submissions_pkey PRIMARY KEY (id);
alter table public.hailmary_licenses add constraint hailmary_licenses_pkey PRIMARY KEY (id);
alter table public.incident_assignments add constraint incident_assignments_pkey PRIMARY KEY (id);
alter table public.incidents add constraint incidents_pkey PRIMARY KEY (id);
alter table public.incoming_leads add constraint incoming_leads_pkey PRIMARY KEY (id);
alter table public.installations add constraint installations_pkey PRIMARY KEY (id);
alter table public.insurance add constraint insurance_pkey PRIMARY KEY (id);
alter table public.intake_events add constraint intake_events_pkey PRIMARY KEY (id);
alter table public.job_dispatch_deliveries add constraint job_dispatch_deliveries_pkey PRIMARY KEY (id);
alter table public.journey_checkpoint_events add constraint journey_checkpoint_events_pkey PRIMARY KEY (id);
alter table public.journey_checkpoints add constraint journey_checkpoints_pkey PRIMARY KEY (slug);
alter table public.lead_followups add constraint lead_followups_pkey PRIMARY KEY (id);
alter table public.leadnet_config add constraint leadnet_config_pkey PRIMARY KEY (id);
alter table public.lto_agreements add constraint lto_agreements_pkey PRIMARY KEY (id);
alter table public.maintenance_appointments add constraint maintenance_appointments_pkey PRIMARY KEY (id);
alter table public.marketing_kpi_weeks add constraint marketing_kpi_weeks_pkey PRIMARY KEY (week_start);
alter table public.marketplace_listings add constraint marketplace_listings_pkey PRIMARY KEY (id);
alter table public.memory_entities add constraint memory_entities_pkey PRIMARY KEY (id);
alter table public.memory_events add constraint memory_events_pkey PRIMARY KEY (id);
alter table public.memory_facts add constraint memory_facts_pkey PRIMARY KEY (id);
alter table public.mesh_nodes add constraint mesh_nodes_pkey PRIMARY KEY (node_id);
alter table public.mission_items add constraint mission_items_pkey PRIMARY KEY (id);
alter table public.money_meter_accounts add constraint money_meter_accounts_pkey PRIMARY KEY (org_id);
alter table public.money_meter_events add constraint money_meter_events_pkey PRIMARY KEY (id);
alter table public.operation_costs add constraint operation_costs_pkey PRIMARY KEY (id);
alter table public.operator_pipeline_tracker add constraint operator_pipeline_tracker_pkey PRIMARY KEY (id);
alter table public.operator_profiles add constraint operator_profiles_pkey PRIMARY KEY (id);
alter table public.operator_rubric_scores add constraint operator_rubric_scores_pkey PRIMARY KEY (id);
alter table public.operator_training_modules add constraint operator_training_modules_pkey PRIMARY KEY (id);
alter table public.operator_training_progress add constraint operator_training_progress_pkey PRIMARY KEY (id);
alter table public.operator_va_assignments add constraint operator_va_assignments_pkey PRIMARY KEY (id);
alter table public.org_responder_links add constraint org_responder_links_pkey PRIMARY KEY (id);
alter table public.org_roles add constraint org_roles_pkey PRIMARY KEY (org_id, user_id, role);
alter table public.organization_domains add constraint organization_domains_pkey PRIMARY KEY (id);
alter table public.organization_licenses add constraint organization_licenses_pkey PRIMARY KEY (organization_id);
alter table public.organizations add constraint organizations_pkey PRIMARY KEY (id);
alter table public.outreach_touches add constraint outreach_touches_pkey PRIMARY KEY (id);
alter table public.package_entitlements add constraint package_entitlements_pkey PRIMARY KEY (package_id, entitlement_slug);
alter table public.packages add constraint packages_pkey PRIMARY KEY (id);
alter table public.parties add constraint parties_pkey PRIMARY KEY (id);
alter table public.partner_app_endpoints add constraint partner_app_endpoints_pkey PRIMARY KEY (id);
alter table public.partner_fleet_access add constraint partner_fleet_access_pkey PRIMARY KEY (id);
alter table public.partner_referrals add constraint partner_referrals_pkey PRIMARY KEY (id);
alter table public.partners add constraint partners_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.people add constraint people_pkey PRIMARY KEY (id);
alter table public.portal_clients add constraint portal_clients_pkey PRIMARY KEY (id);
alter table public.profile_entitlement_grants add constraint profile_entitlement_grants_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.program_applications add constraint program_applications_pkey PRIMARY KEY (id);
alter table public.program_audit_log add constraint program_audit_log_pkey PRIMARY KEY (id);
alter table public.program_documents add constraint program_documents_pkey PRIMARY KEY (id);
alter table public.programs add constraint programs_pkey PRIMARY KEY (slug);
alter table public.protocol_runs add constraint protocol_runs_pkey PRIMARY KEY (id);
alter table public.rental_insurance_products add constraint rental_insurance_products_pkey PRIMARY KEY (id);
alter table public.rental_insurance_selections add constraint rental_insurance_selections_pkey PRIMARY KEY (id);
alter table public.rental_ledger add constraint rental_ledger_pkey PRIMARY KEY (id);
alter table public.rental_pricing_rules add constraint rental_pricing_rules_pkey PRIMARY KEY (id);
alter table public.revenue_splits add constraint revenue_splits_pkey PRIMARY KEY (id);
alter table public.rewards add constraint rewards_pkey PRIMARY KEY (id);
alter table public.routing_candidates add constraint routing_candidates_pkey PRIMARY KEY (id);
alter table public.services add constraint services_pkey PRIMARY KEY (id);
alter table public.shops_mechanics_cleaning add constraint shops_mechanics_cleaning_pkey PRIMARY KEY (id);
alter table public.signup_invites add constraint signup_invites_pkey PRIMARY KEY (id);
alter table public.sync_events add constraint sync_events_pkey PRIMARY KEY (id);
alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id);
alter table public.team_onboarding add constraint team_onboarding_pkey PRIMARY KEY (id);
alter table public.tickets add constraint tickets_pkey PRIMARY KEY (id);
alter table public.time_clock_entries add constraint time_clock_entries_pkey PRIMARY KEY (id);
alter table public.tmmt_token_balances add constraint tmmt_token_balances_pkey PRIMARY KEY (org_id);
alter table public.tmmt_token_events add constraint tmmt_token_events_pkey PRIMARY KEY (id);
alter table public.tmmt_token_ledger add constraint tmmt_token_ledger_pkey PRIMARY KEY (id);
alter table public.training_module_progress add constraint training_module_progress_pkey PRIMARY KEY (id);
alter table public.training_modules add constraint training_modules_pkey PRIMARY KEY (id);
alter table public.unit_locations add constraint unit_locations_pkey PRIMARY KEY (id);
alter table public.units add constraint units_pkey PRIMARY KEY (id);
alter table public.vehicle_damage_reports add constraint vehicle_damage_reports_pkey PRIMARY KEY (id);
alter table public.vehicle_events add constraint vehicle_events_pkey PRIMARY KEY (id);
alter table public.vehicle_handover add constraint vehicle_handover_pkey PRIMARY KEY (id);
alter table public.vehicle_media add constraint vehicle_media_pkey PRIMARY KEY (id);
alter table public.vehicle_onboarding_inspections add constraint vehicle_onboarding_inspections_pkey PRIMARY KEY (id);
alter table public.vehicles add constraint vehicles_pkey PRIMARY KEY (id);
alter table public.vendor_files add constraint vendor_files_pkey PRIMARY KEY (id);
alter table public.vendor_job_updates add constraint vendor_job_updates_pkey PRIMARY KEY (id);
alter table public.vendor_jobs add constraint vendor_jobs_pkey PRIMARY KEY (id);
alter table public.vendors add constraint vendors_pkey PRIMARY KEY (id);
alter table public.ventures add constraint ventures_pkey PRIMARY KEY (id);
alter table public.verticals add constraint verticals_pkey PRIMARY KEY (id);
alter table public.waitlist add constraint waitlist_pkey PRIMARY KEY (id);
alter table public.work_assignments add constraint work_assignments_pkey PRIMARY KEY (id);
alter table public.active_customers add constraint active_customers_airtable_id_key UNIQUE (airtable_id);
alter table public.affiliate_links add constraint affiliate_links_code_key UNIQUE (code);
alter table public.agent_definitions add constraint agent_definitions_slug_key UNIQUE (slug);
alter table public.agent_evaluations add constraint agent_evaluations_session_id_agent_key UNIQUE (session_id, agent);
alter table public.appointments add constraint appointments_airtable_id_key UNIQUE (airtable_id);
alter table public.background_checks add constraint background_checks_airtable_id_key UNIQUE (airtable_id);
alter table public.bookings add constraint bookings_ref_code_key UNIQUE (ref_code);
alter table public.cases add constraint cases_ref_code_key UNIQUE (ref_code);
alter table public.comm_channels add constraint comm_channels_phone_key UNIQUE (phone);
alter table public.contracts add constraint contracts_airtable_id_key UNIQUE (airtable_id);
alter table public.coo_briefings add constraint coo_briefings_briefing_date_kind_key UNIQUE (briefing_date, kind);
alter table public.counselor_escalation_state add constraint counselor_escalation_state_profile_id_issue_key UNIQUE (profile_id, issue);
alter table public.counselor_profile add constraint counselor_profile_ghl_contact_uuid_key UNIQUE (ghl_contact_uuid);
alter table public.credit_education_acknowledgments add constraint credit_education_acknowledgments_profile_id_section_id_key UNIQUE (profile_id, section_id);
alter table public.crm_sync_records add constraint crm_sync_records_ghl_contact_id_ghl_opportunity_id_ghl_pipe_key UNIQUE (ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id);
alter table public.customer_inspection_photos add constraint customer_inspection_photos_airtable_id_key UNIQUE (airtable_id);
alter table public.customer_payments add constraint customer_payments_airtable_id_key UNIQUE (airtable_id);
alter table public.deals add constraint deals_ref_code_key UNIQUE (ref_code);
alter table public.do_not_rent_list add constraint do_not_rent_list_airtable_id_key UNIQUE (airtable_id);
alter table public.employee_access_rights add constraint employee_access_rights_airtable_id_key UNIQUE (airtable_id);
alter table public.expenses add constraint expenses_airtable_id_key UNIQUE (airtable_id);
alter table public.fleet add constraint fleet_airtable_id_key UNIQUE (airtable_id);
alter table public.fleet_car_inspections add constraint fleet_car_inspections_airtable_id_key UNIQUE (airtable_id);
alter table public.former_customers add constraint former_customers_airtable_id_key UNIQUE (airtable_id);
alter table public.garage_builds add constraint garage_builds_slug_key UNIQUE (slug);
alter table public.ghl_appointments add constraint ghl_appointments_ghl_appointment_id_key UNIQUE (ghl_appointment_id);
alter table public.ghl_contacts add constraint ghl_contacts_ghl_contact_id_key UNIQUE (ghl_contact_id);
alter table public.ghl_form_submissions add constraint ghl_form_submissions_ghl_submission_id_key UNIQUE (ghl_submission_id);
alter table public.hailmary_licenses add constraint hailmary_licenses_license_id_key UNIQUE (license_id);
alter table public.incidents add constraint incidents_ref_code_key UNIQUE (ref_code);
alter table public.incoming_leads add constraint incoming_leads_airtable_id_key UNIQUE (airtable_id);
alter table public.installations add constraint installations_license_key_key UNIQUE (license_key);
alter table public.installations add constraint installations_org_id_hardware_uuid_key UNIQUE (org_id, hardware_uuid);
alter table public.insurance add constraint insurance_airtable_id_key UNIQUE (airtable_id);
alter table public.journey_checkpoint_events add constraint journey_checkpoint_events_journey_id_checkpoint_slug_key UNIQUE (journey_id, checkpoint_slug);
alter table public.maintenance_appointments add constraint maintenance_appointments_airtable_id_key UNIQUE (airtable_id);
alter table public.memory_events add constraint memory_events_dedupe_key_key UNIQUE (dedupe_key);
alter table public.money_meter_events add constraint money_meter_events_dedupe_key_key UNIQUE (dedupe_key);
alter table public.operation_costs add constraint operation_costs_airtable_id_key UNIQUE (airtable_id);
alter table public.operator_pipeline_tracker add constraint operator_pipeline_tracker_operator_email_key UNIQUE (operator_email);
alter table public.operator_profiles add constraint operator_profiles_journey_id_key UNIQUE (journey_id);
alter table public.operator_rubric_scores add constraint operator_rubric_scores_operator_id_period_month_key UNIQUE (operator_id, period_month);
alter table public.operator_training_modules add constraint operator_training_modules_slug_key UNIQUE (slug);
alter table public.operator_va_assignments add constraint operator_va_assignments_operator_id_va_profile_id_key UNIQUE (operator_id, va_profile_id);
alter table public.org_responder_links add constraint org_responder_links_org_id_user_id_key UNIQUE (org_id, user_id);
alter table public.packages add constraint packages_slug_key UNIQUE (slug);
alter table public.partner_app_endpoints add constraint partner_app_endpoints_partner_app_slug_key UNIQUE (partner_app_slug);
alter table public.partner_fleet_access add constraint partner_fleet_access_partner_user_id_fleet_id_key UNIQUE (partner_user_id, fleet_id);
alter table public.partners add constraint partners_email_key UNIQUE (email);
alter table public.partners add constraint partners_slug_key UNIQUE (slug);
alter table public.portal_clients add constraint portal_clients_email_key UNIQUE (email);
alter table public.profile_entitlement_grants add constraint profile_entitlement_grants_profile_id_entitlement_slug_key UNIQUE (profile_id, entitlement_slug);
alter table public.profiles add constraint profiles_email_key UNIQUE (email);
alter table public.program_documents add constraint program_documents_storage_path_key UNIQUE (storage_path);
alter table public.rental_insurance_products add constraint rental_insurance_products_tier_coverage_source_key UNIQUE (tier, coverage_source);
alter table public.rental_insurance_selections add constraint rental_insurance_selections_booking_id_key UNIQUE (booking_id);
alter table public.routing_candidates add constraint routing_candidates_candidate_kind_ref_id_key UNIQUE (candidate_kind, ref_id);
alter table public.services add constraint services_slug_key UNIQUE (slug);
alter table public.shops_mechanics_cleaning add constraint shops_mechanics_cleaning_airtable_id_key UNIQUE (airtable_id);
alter table public.signup_invites add constraint signup_invites_code_hash_key UNIQUE (code_hash);
alter table public.tickets add constraint tickets_airtable_id_key UNIQUE (airtable_id);
alter table public.tmmt_token_events add constraint tmmt_token_events_dedupe_key_key UNIQUE (dedupe_key);
alter table public.training_module_progress add constraint training_module_progress_profile_id_module_id_key UNIQUE (profile_id, module_id);
alter table public.training_modules add constraint training_modules_slug_key UNIQUE (slug);
alter table public.units add constraint units_org_id_callsign_key UNIQUE (org_id, callsign);
alter table public.vehicle_handover add constraint vehicle_handover_airtable_id_key UNIQUE (airtable_id);
alter table public.vehicle_onboarding_inspections add constraint vehicle_onboarding_inspections_airtable_id_key UNIQUE (airtable_id);
alter table public.vehicles add constraint vehicles_plate_key UNIQUE (plate);
alter table public.vendors add constraint vendors_auth_user_id_key UNIQUE (auth_user_id);
alter table public.ventures add constraint ventures_slug_key UNIQUE (slug);
alter table public.verticals add constraint verticals_slug_key UNIQUE (slug);
alter table public.waitlist add constraint waitlist_airtable_id_key UNIQUE (airtable_id);
alter table public.affiliate_links add constraint affiliate_links_recurring_pct_check CHECK (((recurring_pct >= 0) AND (recurring_pct <= 90)));
alter table public.agent_conversations add constraint agent_conversations_channel_check CHECK ((channel = ANY (ARRAY['sms'::text, 'voice'::text])));
alter table public.agent_definitions add constraint agent_definitions_fire_on_check CHECK ((fire_on = ANY (ARRAY['insert'::text, 'update'::text, 'both'::text])));
alter table public.agent_jobs add constraint agent_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'skipped'::text])));
alter table public.agent_messages add constraint agent_messages_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text])));
alter table public.automation_outbox add constraint automation_outbox_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])));
alter table public.comm_channels add constraint comm_channels_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text, 'both'::text])));
alter table public.comm_channels add constraint comm_channels_policy_check CHECK ((policy = ANY (ARRAY['normal'::text, 'do_not_contact'::text, 'escalation_only'::text])));
alter table public.comm_channels add constraint comm_channels_provider_check CHECK ((provider = ANY (ARRAY['ghl'::text, 'quo'::text, 'work_cell'::text, 'personal'::text, 'other'::text])));
alter table public.counselor_escalation_state add constraint counselor_escalation_state_level_check CHECK (((level >= 0) AND (level <= 4)));
alter table public.counselor_session add constraint counselor_session_level_used_check CHECK (((level_used >= 0) AND (level_used <= 4)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_awareness_level_check CHECK (((awareness_level = ANY (ARRAY['unaware'::text, 'vaguely_aware'::text, 'monitors_regularly'::text, 'actively_managing'::text])) OR (awareness_level IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_banking_status_check CHECK (((banking_status = ANY (ARRAY['none'::text, 'personal_only'::text, 'separate_business_account'::text, 'multiple_business_accounts'::text])) OR (banking_status IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_bookkeeping_check CHECK (((bookkeeping = ANY (ARRAY['none'::text, 'spreadsheets'::text, 'accounting_software'::text, 'bookkeeper'::text, 'cpa'::text])) OR (bookkeeping IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_documentation_check CHECK (((documentation = ANY (ARRAY['none'::text, 'partial'::text, 'organized_last_12mo'::text, 'organized_24mo+'::text])) OR (documentation IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_entity_standing_check CHECK (((entity_standing = ANY (ARRAY['not_registered'::text, 'registered'::text, 'registered_and_in_good_standing'::text, 'unknown'::text])) OR (entity_standing IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_entity_type_check CHECK (((entity_type = ANY (ARRAY['none'::text, 'sole_prop'::text, 'llc'::text, 's_corp'::text, 'c_corp'::text, 'partnership'::text])) OR (entity_type IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_funding_goal_type_check CHECK (((funding_goal_type = ANY (ARRAY['growth'::text, 'equipment'::text, 'working_capital'::text, 'real_estate'::text, 'refinance'::text, 'other'::text])) OR (funding_goal_type IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_personal_vs_business_focus_check CHECK (((personal_vs_business_focus = ANY (ARRAY['personal'::text, 'business'::text, 'both'::text])) OR (personal_vs_business_focus IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_preferred_channel_check CHECK (((preferred_channel = ANY (ARRAY['sms'::text, 'email'::text, 'in_app'::text])) OR (preferred_channel IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_prior_education_or_program_check CHECK (((prior_education_or_program = ANY (ARRAY['none'::text, 'generic_app'::text, 'paid_program'::text, 'professional_advisor'::text])) OR (prior_education_or_program IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_prior_funding_history_check CHECK (((prior_funding_history = ANY (ARRAY['none'::text, 'applied_no_approval'::text, 'approved_completed'::text, 'currently_servicing'::text])) OR (prior_funding_history IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_revenue_range_check CHECK (((revenue_range = ANY (ARRAY['none'::text, '<50k'::text, '50k-250k'::text, '250k-1m'::text, '>1m'::text])) OR (revenue_range IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_routing_tier_check CHECK (((routing_tier = ANY (ARRAY['education'::text, 'guidance'::text, 'pre_referral'::text, 'introduction'::text])) OR (routing_tier IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_score_banking_readiness_check CHECK (((score_banking_readiness >= 0) AND (score_banking_readiness <= 10)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_score_business_foundation_check CHECK (((score_business_foundation >= 0) AND (score_business_foundation <= 10)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_score_credit_awareness_check CHECK (((score_credit_awareness >= 0) AND (score_credit_awareness <= 10)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_score_financial_organization_check CHECK (((score_financial_organization >= 0) AND (score_financial_organization <= 10)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_score_funding_readiness_check CHECK (((score_funding_readiness >= 0) AND (score_funding_readiness <= 10)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_score_revenue_stability_check CHECK (((score_revenue_stability >= 0) AND (score_revenue_stability <= 10)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_self_reported_score_range_check CHECK (((self_reported_score_range = ANY (ARRAY['<580'::text, '580-619'::text, '620-679'::text, '680-739'::text, '740+'::text, 'unknown'::text])) OR (self_reported_score_range IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_stage_reached_check CHECK (((stage_reached >= 1) AND (stage_reached <= 6)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_team_size_check CHECK (((team_size = ANY (ARRAY['just_me'::text, '2-5'::text, '6-20'::text, '20+'::text])) OR (team_size IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_time_horizon_check CHECK (((time_horizon = ANY (ARRAY['immediate'::text, 'near'::text, 'planning'::text, 'exploring'::text])) OR (time_horizon IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_web_presence_check CHECK (((web_presence = ANY (ARRAY['none'::text, 'social_only'::text, 'landing_page'::text, 'full_site'::text])) OR (web_presence IS NULL)));
alter table public.credit_funding_sessions add constraint credit_funding_sessions_years_in_business_check CHECK (((years_in_business IS NULL) OR (years_in_business >= 0)));
alter table public.customer_services add constraint customer_services_status_check CHECK ((status = ANY (ARRAY['active'::text, 'trial'::text, 'paused'::text, 'cancelled'::text])));
alter table public.enforcement_settings add constraint enforcement_settings_mode_check CHECK ((mode = ANY (ARRAY['shadow'::text, 'live'::text])));
alter table public.enforcement_settings add constraint enforcement_settings_single_row CHECK (id);
alter table public.fleet add constraint fleet_vehicle_class_check CHECK ((vehicle_class = ANY (ARRAY['sport_bike'::text, 'sport_car'::text, 'sport_suv'::text, 'van'::text, 'truck'::text, 'helicopter'::text, 'foot'::text, 'other'::text])));
alter table public.form_submissions add constraint form_submissions_site_check CHECK ((site = ANY (ARRAY['aixmos'::text, 'tmmt'::text])));
alter table public.garage_builds add constraint garage_builds_earned_cents_check CHECK ((earned_cents >= 0));
alter table public.garage_builds add constraint garage_builds_price_cents_check CHECK ((price_cents > 0));
alter table public.hailmary_licenses add constraint hailmary_licenses_tier_check CHECK ((tier = ANY (ARRAY['taste'::text, 'starter'::text, 'operator'::text, 'flagship'::text])));
alter table public.incident_assignments add constraint incident_assignments_assigned_by_kind_check CHECK ((assigned_by_kind = ANY (ARRAY['system'::text, 'user'::text])));
alter table public.incident_assignments add constraint incident_assignments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'locked'::text, 'cancelled'::text, 'completed'::text])));
alter table public.incidents add constraint incidents_severity_check CHECK ((severity = ANY (ARRAY[1, 2, 3])));
alter table public.incidents add constraint incidents_status_check CHECK ((status = ANY (ARRAY['received'::text, 'assigning'::text, 'assigned'::text, 'en_route'::text, 'on_scene'::text, 'cleared'::text, 'closed'::text, 'cancelled'::text])));
alter table public.incoming_leads add constraint incoming_leads_agent_status_check CHECK ((agent_status = ANY (ARRAY['NEW'::text, 'CONTACTED'::text, 'QUALIFIED'::text, 'BOOKED'::text, 'CLOSED'::text, 'LOST'::text, 'HUMAN_HANDOFF'::text])));
alter table public.incoming_leads add constraint incoming_leads_lane_check CHECK (((lane IS NULL) OR (lane = ANY (ARRAY['rental'::text, 'detail'::text]))));
alter table public.incoming_leads add constraint incoming_leads_source_confidence_check CHECK (((source_confidence IS NULL) OR (source_confidence = ANY (ARRAY['evidenced'::text, 'unknown'::text, 'captured'::text]))));
alter table public.installations add constraint installations_status_check CHECK ((status = ANY (ARRAY['locked'::text, 'provisioning'::text, 'setup'::text, 'comprehension'::text, 'active'::text, 'suspended'::text, 'revoked'::text])));
alter table public.intake_events add constraint intake_events_confidence_check CHECK ((confidence = ANY (ARRAY['rule'::text, 'model'::text, 'manual'::text, 'unresolved'::text])));
alter table public.lead_followups add constraint lead_followups_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'escalated'::text])));
alter table public.leadnet_config add constraint leadnet_config_id_check CHECK (id);
alter table public.memory_entities add constraint memory_entities_kind_check CHECK ((kind = ANY (ARRAY['person'::text, 'vehicle'::text, 'deal'::text, 'vendor'::text, 'org'::text, 'other'::text])));
alter table public.memory_events add constraint memory_events_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['ai_agent'::text, 'operator'::text, 'team'::text, 'owner'::text, 'external'::text, 'system'::text])));
alter table public.memory_events add constraint memory_events_source_check CHECK ((source = ANY (ARRAY['app'::text, 'slack'::text, 'clickup'::text, 'gmail'::text, 'quo'::text, 'calendar'::text, 'airtable'::text, 'agent'::text, 'system'::text])));
alter table public.memory_facts add constraint memory_facts_confidence_check CHECK (((confidence >= (0)::double precision) AND (confidence <= (1)::double precision)));
alter table public.memory_facts add constraint memory_facts_visibility_check CHECK ((visibility = ANY (ARRAY['org'::text, 'owner'::text])));
alter table public.mesh_nodes add constraint mesh_nodes_kill_tier_check CHECK (((kill_tier >= 0) AND (kill_tier <= 4)));
alter table public.mesh_nodes add constraint mesh_nodes_status_check CHECK ((status = ANY (ARRAY['LIVE'::text, 'PAUSED'::text, 'SEALED'::text, 'DARK'::text])));
alter table public.money_meter_events add constraint money_meter_events_amount_usd_check CHECK ((amount_usd >= (0)::numeric));
alter table public.money_meter_events add constraint money_meter_events_direction_check CHECK ((direction = ANY (ARRAY['collected'::text, 'used'::text, 'saved'::text])));
alter table public.operator_rubric_scores add constraint operator_rubric_scores_total_score_check CHECK (((total_score >= 0) AND (total_score <= 100)));
alter table public.operator_training_modules add constraint operator_training_modules_track_check CHECK ((track = ANY (ARRAY['core'::text, 'tmmt'::text, 'moe'::text, 'capstone'::text])));
alter table public.org_responder_links add constraint org_responder_links_link_kind_check CHECK ((link_kind = ANY (ARRAY['vendor'::text, 'operator'::text, 'client_volunteer'::text, 'contractor'::text])));
alter table public.org_roles add constraint org_roles_role_check CHECK ((role = ANY (ARRAY['tenant_admin'::text, 'dispatcher'::text, 'responder'::text, 'viewer'::text])));
alter table public.organization_domains add constraint organization_domains_hostname_lower CHECK (((hostname = lower(hostname)) AND (hostname !~~ '%:%'::text) AND (hostname <> ''::text)));
alter table public.organization_licenses add constraint organization_licenses_kill_command_check CHECK (((kill_command IS NULL) OR (kill_command = 'wipe'::text)));
alter table public.outreach_touches add constraint outreach_touches_channel_check CHECK ((channel = ANY (ARRAY['sms'::text, 'call'::text, 'email'::text, 'dm'::text, 'in_person'::text])));
alter table public.outreach_touches add constraint outreach_touches_direction_check CHECK ((direction = ANY (ARRAY['outbound'::text, 'inbound'::text])));
alter table public.outreach_touches add constraint outreach_touches_outcome_check CHECK ((outcome = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'replied'::text, 'opted_out'::text, 'booked'::text, 'no_answer'::text, 'bad_number'::text])));
alter table public.packages add constraint packages_price_nonnegative CHECK (((price_cents IS NULL) OR (price_cents >= 0)));
alter table public.packages add constraint packages_price_range_valid CHECK (((price_max_cents IS NULL) OR ((price_cents IS NOT NULL) AND (price_max_cents >= price_cents))));
alter table public.partner_referrals add constraint partner_referrals_dest_org_check CHECK ((dest_org = ANY (ARRAY['tmmt'::text, 'aixmos'::text, 'khan_strategies'::text])));
alter table public.partner_referrals add constraint partner_referrals_distinct_orgs CHECK ((source_org <> dest_org));
alter table public.partner_referrals add constraint partner_referrals_source_org_check CHECK ((source_org = ANY (ARRAY['tmmt'::text, 'aixmos'::text, 'khan_strategies'::text])));
alter table public.partner_referrals add constraint partner_referrals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'completed'::text, 'paid'::text])));
alter table public.programs add constraint programs_lane_check CHECK (((lane IS NULL) OR (lane = ANY (ARRAY['rental'::text, 'detail'::text]))));
alter table public.routing_candidates add constraint routing_candidates_candidate_kind_check CHECK ((candidate_kind = ANY (ARRAY['employee'::text, 'agent'::text, 'vendor'::text, 'unit'::text])));
alter table public.routing_candidates add constraint routing_candidates_status_check CHECK ((status = ANY (ARRAY['available'::text, 'busy'::text, 'off'::text, 'inactive'::text])));
alter table public.tasks add constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['High'::text, 'Medium'::text, 'Low'::text])));
alter table public.tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['To Do'::text, 'In Progress'::text, 'Done'::text, 'Blocked'::text])));
alter table public.tmmt_token_balances add constraint tmmt_token_balances_balance_check CHECK ((balance >= 0));
alter table public.tmmt_token_balances add constraint tmmt_token_balances_monthly_allotment_check CHECK ((monthly_allotment >= 0));
alter table public.tmmt_token_balances add constraint tmmt_token_balances_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])));
alter table public.tmmt_token_ledger add constraint tmmt_token_ledger_event_check CHECK ((event = ANY (ARRAY['issue'::text, 'redeem'::text, 'spend'::text, 'revoke'::text])));
alter table public.tmmt_token_ledger add constraint tmmt_token_ledger_tier_check CHECK ((tier = ANY (ARRAY['FREE'::text, 'OPERATOR'::text, 'FOUNDER'::text])));
alter table public.training_module_progress add constraint training_module_progress_percent_complete_check CHECK (((percent_complete >= 0) AND (percent_complete <= 100)));
alter table public.unit_locations add constraint unit_locations_heading_check CHECK (((heading >= 0) AND (heading <= 359)));
alter table public.units add constraint units_status_check CHECK ((status = ANY (ARRAY['off_duty'::text, 'available'::text, 'assigned'::text, 'en_route'::text, 'on_scene'::text, 'out_of_service'::text])));
alter table public.ventures add constraint ventures_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'archived'::text])));
alter table public.work_assignments add constraint work_assignments_assigned_by_kind_check CHECK ((assigned_by_kind = ANY (ARRAY['system'::text, 'user'::text])));
alter table public.work_assignments add constraint work_assignments_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'assigned'::text, 'accepted'::text, 'completed'::text, 'cancelled'::text])));
alter table public.active_customers add constraint active_customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.affiliate_links add constraint affiliate_links_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operator_profiles(id) ON DELETE CASCADE;
alter table public.agent_conversations add constraint agent_conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES incoming_leads(id);
alter table public.agent_conversations add constraint agent_conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.agent_evaluation_sessions add constraint agent_evaluation_sessions_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.agent_evaluations add constraint agent_evaluations_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.agent_evaluations add constraint agent_evaluations_session_id_fkey FOREIGN KEY (session_id) REFERENCES agent_evaluation_sessions(id) ON DELETE CASCADE;
alter table public.agent_jobs add constraint agent_jobs_agent_slug_fkey FOREIGN KEY (agent_slug) REFERENCES agent_definitions(slug) ON DELETE CASCADE;
alter table public.agent_messages add constraint agent_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id);
alter table public.appointments add constraint appointments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.assignment_overrides add constraint assignment_overrides_chosen_unit_id_fkey FOREIGN KEY (chosen_unit_id) REFERENCES units(id) ON DELETE RESTRICT;
alter table public.assignment_overrides add constraint assignment_overrides_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE;
alter table public.assignment_overrides add constraint assignment_overrides_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.assignment_overrides add constraint assignment_overrides_original_unit_id_fkey FOREIGN KEY (original_unit_id) REFERENCES units(id) ON DELETE RESTRICT;
alter table public.audit_events add constraint audit_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.background_checks add constraint background_checks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.background_checks add constraint background_checks_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
alter table public.bills add constraint bills_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.bills add constraint bills_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.bookings add constraint bookings_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.bookings add constraint bookings_manager_discount_approved_by_fkey FOREIGN KEY (manager_discount_approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.bookings add constraint bookings_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.bookings add constraint bookings_pricing_rule_id_fkey FOREIGN KEY (pricing_rule_id) REFERENCES rental_pricing_rules(id) ON DELETE SET NULL;
alter table public.bookings add constraint bookings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.bookings add constraint bookings_supervisor_discount_approved_by_fkey FOREIGN KEY (supervisor_discount_approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.bookings add constraint bookings_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
alter table public.case_client_updates add constraint case_client_updates_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.case_client_updates add constraint case_client_updates_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.case_client_updates add constraint case_client_updates_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.case_status_history add constraint case_status_history_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.case_status_history add constraint case_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.case_status_history add constraint case_status_history_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.cases add constraint cases_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.cases add constraint cases_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES customer_intake_forms(id) ON DELETE SET NULL;
alter table public.cases add constraint cases_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.clickup_tasks add constraint clickup_tasks_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.clickup_tasks add constraint clickup_tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.client_alerts add constraint client_alerts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.client_alerts add constraint client_alerts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.client_alerts add constraint client_alerts_sync_record_id_fkey FOREIGN KEY (sync_record_id) REFERENCES crm_sync_records(id) ON DELETE SET NULL;
alter table public.client_journey add constraint client_journey_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
alter table public.client_journey add constraint client_journey_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.client_journey add constraint client_journey_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.comm_channels add constraint comm_channels_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.contract_instances add constraint contract_instances_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;
alter table public.contract_instances add constraint contract_instances_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES client_journey(id) ON DELETE CASCADE;
alter table public.contract_instances add constraint contract_instances_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.contracts add constraint contracts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.coo_briefings add constraint coo_briefings_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.coo_briefings add constraint coo_briefings_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.counselor_escalation_state add constraint counselor_escalation_state_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES counselor_profile(id) ON DELETE CASCADE;
alter table public.counselor_interaction add constraint counselor_interaction_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES counselor_profile(id) ON DELETE CASCADE;
alter table public.counselor_profile add constraint counselor_profile_ghl_contact_uuid_fkey FOREIGN KEY (ghl_contact_uuid) REFERENCES ghl_contacts(id) ON DELETE CASCADE;
alter table public.counselor_profile_snapshot add constraint counselor_profile_snapshot_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES counselor_profile(id) ON DELETE CASCADE;
alter table public.counselor_resistance_event add constraint counselor_resistance_event_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES counselor_profile(id) ON DELETE CASCADE;
alter table public.counselor_session add constraint counselor_session_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES counselor_profile(id) ON DELETE CASCADE;
alter table public.credit_billing_plans add constraint credit_billing_plans_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES credit_enrollments(id) ON DELETE CASCADE;
alter table public.credit_billing_plans add constraint credit_billing_plans_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES client_journey(id) ON DELETE CASCADE;
alter table public.credit_billing_plans add constraint credit_billing_plans_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.credit_education_acknowledgments add constraint credit_education_acknowledgments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.credit_education_acknowledgments add constraint credit_education_acknowledgments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.credit_education_acknowledgments add constraint credit_education_acknowledgments_section_id_fkey FOREIGN KEY (section_id) REFERENCES credit_education_sections(id) ON DELETE CASCADE;
alter table public.credit_enrollments add constraint credit_enrollments_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.credit_enrollments add constraint credit_enrollments_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES client_journey(id) ON DELETE CASCADE;
alter table public.credit_enrollments add constraint credit_enrollments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.credit_enrollments add constraint credit_enrollments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.credit_funding_sessions add constraint credit_funding_sessions_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.credit_payment_schedule add constraint credit_payment_schedule_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES rental_ledger(id) ON DELETE SET NULL;
alter table public.credit_payment_schedule add constraint credit_payment_schedule_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.credit_payment_schedule add constraint credit_payment_schedule_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES credit_billing_plans(id) ON DELETE CASCADE;
alter table public.crm_sync_records add constraint crm_sync_records_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.customer_inspection_photos add constraint customer_inspection_photos_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.customer_payments add constraint customer_payments_incoming_lead_id_fkey FOREIGN KEY (incoming_lead_id) REFERENCES incoming_leads(id) ON DELETE SET NULL;
alter table public.customer_payments add constraint customer_payments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.customer_services add constraint customer_services_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES memory_entities(id) ON DELETE SET NULL;
alter table public.customer_services add constraint customer_services_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.deal_payments add constraint deal_payments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table public.deal_payments add constraint deal_payments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.deals add constraint deals_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.deals add constraint deals_enrollment_payment_id_fkey FOREIGN KEY (enrollment_payment_id) REFERENCES customer_payments(id) ON DELETE SET NULL;
alter table public.deals add constraint deals_incoming_lead_id_fkey FOREIGN KEY (incoming_lead_id) REFERENCES incoming_leads(id) ON DELETE SET NULL;
alter table public.deals add constraint deals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.deals add constraint deals_party_id_fkey FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL;
alter table public.do_not_rent_list add constraint do_not_rent_list_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.documents add constraint documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.documents add constraint documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.expenses add constraint expenses_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.fleet add constraint fleet_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.fleet_car_inspections add constraint fleet_car_inspections_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.form_submissions add constraint form_submissions_person_id_fkey FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
alter table public.former_customers add constraint former_customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.garage_gates add constraint garage_gates_build_id_fkey FOREIGN KEY (build_id) REFERENCES garage_builds(id) ON DELETE CASCADE;
alter table public.garage_history add constraint garage_history_build_id_fkey FOREIGN KEY (build_id) REFERENCES garage_builds(id) ON DELETE CASCADE;
alter table public.garage_ledger add constraint garage_ledger_build_id_fkey FOREIGN KEY (build_id) REFERENCES garage_builds(id) ON DELETE CASCADE;
alter table public.garage_mods add constraint garage_mods_build_id_fkey FOREIGN KEY (build_id) REFERENCES garage_builds(id) ON DELETE CASCADE;
alter table public.ghl_form_submissions add constraint ghl_form_submissions_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.ghl_form_submissions add constraint ghl_form_submissions_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES customer_intake_forms(id) ON DELETE SET NULL;
alter table public.incident_assignments add constraint incident_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.incident_assignments add constraint incident_assignments_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE;
alter table public.incident_assignments add constraint incident_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.incident_assignments add constraint incident_assignments_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT;
alter table public.incidents add constraint incidents_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.incidents add constraint incidents_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.incoming_leads add constraint incoming_leads_affiliate_operator_id_fkey FOREIGN KEY (affiliate_operator_id) REFERENCES operator_profiles(id);
alter table public.incoming_leads add constraint incoming_leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.incoming_leads add constraint incoming_leads_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.incoming_leads add constraint incoming_leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
alter table public.incoming_leads add constraint incoming_leads_referred_by_lead_id_fkey FOREIGN KEY (referred_by_lead_id) REFERENCES incoming_leads(id) ON DELETE SET NULL;
alter table public.installations add constraint installations_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.insurance add constraint insurance_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.intake_events add constraint intake_events_program_fkey FOREIGN KEY (program) REFERENCES programs(slug);
alter table public.job_dispatch_deliveries add constraint job_dispatch_deliveries_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.job_dispatch_deliveries add constraint job_dispatch_deliveries_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES partner_app_endpoints(id) ON DELETE SET NULL;
alter table public.journey_checkpoint_events add constraint journey_checkpoint_events_checkpoint_slug_fkey FOREIGN KEY (checkpoint_slug) REFERENCES journey_checkpoints(slug) ON DELETE CASCADE;
alter table public.journey_checkpoint_events add constraint journey_checkpoint_events_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES client_journey(id) ON DELETE CASCADE;
alter table public.journey_checkpoint_events add constraint journey_checkpoint_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.lead_followups add constraint lead_followups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES incoming_leads(id) ON DELETE CASCADE;
alter table public.lto_agreements add constraint lto_agreements_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES client_journey(id) ON DELETE CASCADE;
alter table public.lto_agreements add constraint lto_agreements_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.maintenance_appointments add constraint maintenance_appointments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.marketing_kpi_weeks add constraint marketing_kpi_weeks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.marketing_kpi_weeks add constraint marketing_kpi_weeks_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.marketplace_listings add constraint marketplace_listings_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.marketplace_listings add constraint marketplace_listings_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.memory_entities add constraint memory_entities_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.memory_events add constraint memory_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.memory_events add constraint memory_events_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES memory_entities(id) ON DELETE SET NULL;
alter table public.memory_events add constraint memory_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.memory_facts add constraint memory_facts_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES memory_entities(id) ON DELETE SET NULL;
alter table public.memory_facts add constraint memory_facts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.memory_facts add constraint memory_facts_source_event_fkey FOREIGN KEY (source_event) REFERENCES memory_events(id) ON DELETE SET NULL;
alter table public.mission_items add constraint mission_items_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.money_meter_accounts add constraint money_meter_accounts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.money_meter_events add constraint money_meter_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.operation_costs add constraint operation_costs_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.operator_pipeline_tracker add constraint operator_pipeline_tracker_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.operator_profiles add constraint operator_profiles_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES client_journey(id) ON DELETE SET NULL;
alter table public.operator_profiles add constraint operator_profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.operator_profiles add constraint operator_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.operator_rubric_scores add constraint operator_rubric_scores_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operator_profiles(id) ON DELETE CASCADE;
alter table public.operator_rubric_scores add constraint operator_rubric_scores_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.operator_rubric_scores add constraint operator_rubric_scores_scored_by_fkey FOREIGN KEY (scored_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.operator_training_progress add constraint operator_training_progress_module_id_fkey FOREIGN KEY (module_id) REFERENCES operator_training_modules(id) ON DELETE CASCADE;
alter table public.operator_va_assignments add constraint operator_va_assignments_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operator_profiles(id) ON DELETE CASCADE;
alter table public.operator_va_assignments add constraint operator_va_assignments_va_profile_id_fkey FOREIGN KEY (va_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.org_responder_links add constraint org_responder_links_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.org_responder_links add constraint org_responder_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.org_responder_links add constraint org_responder_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.org_roles add constraint org_roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.org_roles add constraint org_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.organization_domains add constraint organization_domains_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.organization_licenses add constraint organization_licenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.organizations add constraint organizations_parent_agency_id_fkey FOREIGN KEY (parent_agency_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.outreach_touches add constraint outreach_touches_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES incoming_leads(id) ON DELETE CASCADE;
alter table public.package_entitlements add constraint package_entitlements_entitlement_slug_fkey FOREIGN KEY (entitlement_slug) REFERENCES entitlements(slug) ON DELETE CASCADE;
alter table public.package_entitlements add constraint package_entitlements_package_id_fkey FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE;
alter table public.parties add constraint parties_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.partner_fleet_access add constraint partner_fleet_access_fleet_id_fkey FOREIGN KEY (fleet_id) REFERENCES fleet(id) ON DELETE CASCADE;
alter table public.partner_fleet_access add constraint partner_fleet_access_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.partner_fleet_access add constraint partner_fleet_access_partner_user_id_fkey FOREIGN KEY (partner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.partner_referrals add constraint partner_referrals_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.partner_referrals add constraint partner_referrals_source_operator_id_fkey FOREIGN KEY (source_operator_id) REFERENCES organizations(id);
alter table public.payments add constraint payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
alter table public.payments add constraint payments_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.payments add constraint payments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.payments add constraint payments_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.profile_entitlement_grants add constraint profile_entitlement_grants_entitlement_slug_fkey FOREIGN KEY (entitlement_slug) REFERENCES entitlements(slug) ON DELETE CASCADE;
alter table public.profile_entitlement_grants add constraint profile_entitlement_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.profile_entitlement_grants add constraint profile_entitlement_grants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_package_id_fkey FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;
alter table public.program_applications add constraint program_applications_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.program_audit_log add constraint program_audit_log_application_id_fkey FOREIGN KEY (application_id) REFERENCES program_applications(id) ON DELETE CASCADE;
alter table public.program_documents add constraint program_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES program_applications(id) ON DELETE CASCADE;
alter table public.program_documents add constraint program_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.program_documents add constraint program_documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.protocol_runs add constraint protocol_runs_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.rental_insurance_selections add constraint rental_insurance_selections_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
alter table public.rental_insurance_selections add constraint rental_insurance_selections_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.rental_insurance_selections add constraint rental_insurance_selections_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.rental_insurance_selections add constraint rental_insurance_selections_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.rental_ledger add constraint rental_ledger_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
alter table public.rental_ledger add constraint rental_ledger_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.rental_ledger add constraint rental_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.rental_ledger add constraint rental_ledger_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.rental_pricing_rules add constraint rental_pricing_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.revenue_splits add constraint revenue_splits_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
alter table public.revenue_splits add constraint revenue_splits_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operator_profiles(id) ON DELETE CASCADE;
alter table public.revenue_splits add constraint revenue_splits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.rewards add constraint rewards_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.rewards add constraint rewards_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.routing_candidates add constraint routing_candidates_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.services add constraint services_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.shops_mechanics_cleaning add constraint shops_mechanics_cleaning_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.sync_events add constraint sync_events_sync_record_id_fkey FOREIGN KEY (sync_record_id) REFERENCES crm_sync_records(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.tickets add constraint tickets_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.time_clock_entries add constraint time_clock_entries_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.time_clock_entries add constraint time_clock_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tmmt_token_balances add constraint tmmt_token_balances_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.tmmt_token_events add constraint tmmt_token_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.training_module_progress add constraint training_module_progress_module_id_fkey FOREIGN KEY (module_id) REFERENCES training_modules(id) ON DELETE CASCADE;
alter table public.training_module_progress add constraint training_module_progress_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.training_module_progress add constraint training_module_progress_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.unit_locations add constraint unit_locations_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.unit_locations add constraint unit_locations_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE;
alter table public.units add constraint units_active_assignment_fk FOREIGN KEY (active_assignment_id) REFERENCES incident_assignments(id) ON DELETE SET NULL;
alter table public.units add constraint units_fleet_id_fkey FOREIGN KEY (fleet_id) REFERENCES fleet(id) ON DELETE SET NULL;
alter table public.units add constraint units_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.units add constraint units_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.vehicle_damage_reports add constraint vehicle_damage_reports_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
alter table public.vehicle_damage_reports add constraint vehicle_damage_reports_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.vehicle_damage_reports add constraint vehicle_damage_reports_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vehicle_damage_reports add constraint vehicle_damage_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.vehicle_damage_reports add constraint vehicle_damage_reports_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
alter table public.vehicle_events add constraint vehicle_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
alter table public.vehicle_events add constraint vehicle_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.vehicle_events add constraint vehicle_events_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES client_journey(id) ON DELETE SET NULL;
alter table public.vehicle_events add constraint vehicle_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vehicle_handover add constraint vehicle_handover_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vehicle_media add constraint vehicle_media_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
alter table public.vehicle_media add constraint vehicle_media_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;
alter table public.vehicle_media add constraint vehicle_media_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vehicle_media add constraint vehicle_media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.vehicle_media add constraint vehicle_media_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
alter table public.vehicle_onboarding_inspections add constraint vehicle_onboarding_inspections_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vehicles add constraint vehicles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vendor_files add constraint vendor_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vendor_files add constraint vendor_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.vendor_files add constraint vendor_files_vendor_job_id_fkey FOREIGN KEY (vendor_job_id) REFERENCES vendor_jobs(id) ON DELETE CASCADE;
alter table public.vendor_job_updates add constraint vendor_job_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.vendor_job_updates add constraint vendor_job_updates_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vendor_job_updates add constraint vendor_job_updates_vendor_job_id_fkey FOREIGN KEY (vendor_job_id) REFERENCES vendor_jobs(id) ON DELETE CASCADE;
alter table public.vendor_jobs add constraint vendor_jobs_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.vendor_jobs add constraint vendor_jobs_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.vendor_jobs add constraint vendor_jobs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT;
alter table public.ventures add constraint ventures_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.verticals add constraint verticals_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.waitlist add constraint waitlist_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.work_assignments add constraint work_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.work_assignments add constraint work_assignments_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES routing_candidates(id) ON DELETE SET NULL;
alter table public.work_assignments add constraint work_assignments_case_id_fkey FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
alter table public.work_assignments add constraint work_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);

-- ============ 6. INDEXES ============
create unique index if not exists active_customers_license_upload_token_key ON public.active_customers USING btree (license_upload_token) WHERE (license_upload_token IS NOT NULL);
create index if not exists active_customers_org_idx ON public.active_customers USING btree (org_id);
create index if not exists idx_afflinks_operator ON public.affiliate_links USING btree (operator_id);
create index if not exists agent_conversations_lead_idx ON public.agent_conversations USING btree (lead_id);
create index if not exists agent_conversations_org_started_idx ON public.agent_conversations USING btree (organization_id, started_at DESC);
create index if not exists agent_evaluation_sessions_org_idx ON public.agent_evaluation_sessions USING btree (org_id);
create index if not exists agent_sessions_subject_idx ON public.agent_evaluation_sessions USING btree (subject_type, subject_id);
create index if not exists agent_evaluations_org_idx ON public.agent_evaluations USING btree (org_id);
create index if not exists agent_jobs_queue_idx ON public.agent_jobs USING btree (status, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));
create index if not exists agent_jobs_record_idx ON public.agent_jobs USING btree (source_table, record_id);
create index if not exists agent_messages_conv_ts_idx ON public.agent_messages USING btree (conversation_id, ts);
create index if not exists appointments_org_idx ON public.appointments USING btree (org_id);
create index if not exists ao_incident_idx ON public.assignment_overrides USING btree (incident_id);
create index if not exists assignment_overrides_org_idx ON public.assignment_overrides USING btree (org_id);
create index if not exists audit_events_action_idx ON public.audit_events USING btree (action);
create index if not exists audit_events_org_ts_idx ON public.audit_events USING btree (organization_id, ts DESC);
create index if not exists automation_outbox_queue_idx ON public.automation_outbox USING btree (status, created_at) WHERE (status = 'queued'::text);
create unique index if not exists background_checks_license_upload_token_key ON public.background_checks USING btree (license_upload_token) WHERE (license_upload_token IS NOT NULL);
create index if not exists background_checks_org_idx ON public.background_checks USING btree (org_id);
create index if not exists bills_due_idx ON public.bills USING btree (next_due_date);
create index if not exists bills_org_idx ON public.bills USING btree (org_id);
create index if not exists bills_owner_idx ON public.bills USING btree (owner_id);
create index if not exists bills_status_idx ON public.bills USING btree (status);
create index if not exists bookings_case_id_fkey_idx ON public.bookings USING btree (case_id);
create index if not exists bookings_org_idx ON public.bookings USING btree (org_id);
create index if not exists bookings_profile_idx ON public.bookings USING btree (profile_id);
create index if not exists bookings_status_idx ON public.bookings USING btree (status);
create index if not exists bookings_vehicle_idx ON public.bookings USING btree (vehicle_id);
create index if not exists case_client_updates_case_idx ON public.case_client_updates USING btree (case_id, created_at DESC);
create index if not exists case_client_updates_email_idx ON public.case_client_updates USING btree (lower(customer_email), created_at DESC);
create index if not exists case_client_updates_org_idx ON public.case_client_updates USING btree (org_id);
create index if not exists case_client_updates_posted_by_fkey_idx ON public.case_client_updates USING btree (posted_by);
create index if not exists case_status_history_changed_by_fkey_idx ON public.case_status_history USING btree (changed_by);
create index if not exists case_status_history_org_idx ON public.case_status_history USING btree (org_id);
create index if not exists csh_case_idx ON public.case_status_history USING btree (case_id, created_at DESC);
create index if not exists cases_assigned_to_idx ON public.cases USING btree (assigned_to);
create index if not exists cases_business_line_idx ON public.cases USING btree (business_line);
create index if not exists cases_intake_idx ON public.cases USING btree (intake_id);
create index if not exists cases_org_idx ON public.cases USING btree (org_id);
create index if not exists clickup_tasks_org_idx ON public.clickup_tasks USING btree (org_id);
create index if not exists client_alerts_email_idx ON public.client_alerts USING btree (lower(customer_email));
create index if not exists client_alerts_org_idx ON public.client_alerts USING btree (org_id);
create index if not exists client_alerts_profile_id_fkey_idx ON public.client_alerts USING btree (profile_id);
create index if not exists client_alerts_sync_record_id_fkey_idx ON public.client_alerts USING btree (sync_record_id);
create index if not exists client_alerts_unread_idx ON public.client_alerts USING btree (customer_email, acknowledged_at);
create index if not exists client_journey_email_idx ON public.client_journey USING btree (lower(customer_email));
create unique index if not exists client_journey_email_unique ON public.client_journey USING btree (lower(customer_email));
create index if not exists client_journey_org_idx ON public.client_journey USING btree (org_id);
create index if not exists client_journey_profile_idx ON public.client_journey USING btree (profile_id);
create index if not exists client_updates_client_email_idx ON public.client_updates USING btree (client_email);
create index if not exists client_updates_partner_slug_idx ON public.client_updates USING btree (partner_slug);
create index if not exists comm_channels_org_idx ON public.comm_channels USING btree (org_id);
create index if not exists comm_channels_policy_idx ON public.comm_channels USING btree (policy);
create index if not exists comm_channels_purpose_idx ON public.comm_channels USING btree (purpose);
create index if not exists contract_instances_org_idx ON public.contract_instances USING btree (org_id);
create index if not exists contracts_org_idx ON public.contracts USING btree (org_id);
create index if not exists coo_briefings_org_idx ON public.coo_briefings USING btree (org_id);
create index if not exists counselor_escalation_state_org_idx ON public.counselor_escalation_state USING btree (organization_id);
create index if not exists counselor_interaction_org_idx ON public.counselor_interaction USING btree (organization_id);
create index if not exists counselor_interaction_profile_idx ON public.counselor_interaction USING btree (profile_id);
create index if not exists counselor_profile_email_idx ON public.counselor_profile USING btree (customer_email);
create index if not exists counselor_profile_ghl_idx ON public.counselor_profile USING btree (ghl_contact_id);
create index if not exists counselor_profile_org_idx ON public.counselor_profile USING btree (organization_id);
create index if not exists counselor_profile_snapshot_org_idx ON public.counselor_profile_snapshot USING btree (organization_id);
create index if not exists counselor_snapshot_profile_idx ON public.counselor_profile_snapshot USING btree (profile_id);
create index if not exists counselor_resistance_event_org_idx ON public.counselor_resistance_event USING btree (organization_id);
create index if not exists counselor_resistance_profile_idx ON public.counselor_resistance_event USING btree (profile_id, issue);
create index if not exists counselor_session_issue_idx ON public.counselor_session USING btree (profile_id, issue);
create index if not exists counselor_session_org_idx ON public.counselor_session USING btree (organization_id);
create index if not exists counselor_session_profile_idx ON public.counselor_session USING btree (profile_id);
create unique index if not exists credit_billing_one_active_base ON public.credit_billing_plans USING btree (journey_id) WHERE ((status = 'active'::credit_plan_status) AND (is_add_on = false) AND (credit_path = ANY (ARRAY['monthly_97'::credit_path, 'payment_plan_500'::credit_path])));
create index if not exists credit_billing_plans_journey_idx ON public.credit_billing_plans USING btree (journey_id);
create index if not exists credit_billing_plans_org_idx ON public.credit_billing_plans USING btree (org_id);
create index if not exists credit_education_acknowledgments_org_idx ON public.credit_education_acknowledgments USING btree (org_id);
create index if not exists credit_enrollments_journey_idx ON public.credit_enrollments USING btree (journey_id);
create index if not exists credit_enrollments_org_idx ON public.credit_enrollments USING btree (org_id);
create index if not exists credit_funding_sessions_affiliate_ref_idx ON public.credit_funding_sessions USING btree (affiliate_ref) WHERE (affiliate_ref IS NOT NULL);
create index if not exists credit_funding_sessions_created_at_idx ON public.credit_funding_sessions USING btree (created_at DESC);
create index if not exists credit_funding_sessions_handoff_idx ON public.credit_funding_sessions USING btree (operator_handoff_requested) WHERE (operator_handoff_requested = true);
create index if not exists credit_funding_sessions_org_idx ON public.credit_funding_sessions USING btree (org_id);
create index if not exists credit_funding_sessions_routing_tier_idx ON public.credit_funding_sessions USING btree (routing_tier);
create index if not exists credit_funding_sessions_score_total_idx ON public.credit_funding_sessions USING btree (score_total DESC);
create index if not exists credit_payment_schedule_org_idx ON public.credit_payment_schedule USING btree (org_id);
create index if not exists crm_sync_ghl_contact_idx ON public.crm_sync_records USING btree (ghl_contact_id);
create index if not exists crm_sync_records_case_id_fkey_idx ON public.crm_sync_records USING btree (case_id);
create index if not exists crm_sync_status_idx ON public.crm_sync_records USING btree (sync_status);
create index if not exists customer_inspection_photos_org_idx ON public.customer_inspection_photos USING btree (org_id);
create index if not exists customer_intake_business_line_idx ON public.customer_intake_forms USING btree (business_line);
create index if not exists intake_created_idx ON public.customer_intake_forms USING btree (created_at DESC);
create index if not exists customer_payments_incoming_lead_id_idx ON public.customer_payments USING btree (incoming_lead_id);
create index if not exists customer_payments_org_idx ON public.customer_payments USING btree (org_id);
create index if not exists customer_payments_product_code_idx ON public.customer_payments USING btree (product_code);
create index if not exists customer_services_email_idx ON public.customer_services USING btree (contact_email);
create index if not exists customer_services_entity_idx ON public.customer_services USING btree (entity_id);
create index if not exists customer_services_org_idx ON public.customer_services USING btree (org_id);
create index if not exists customer_services_phone_idx ON public.customer_services USING btree (contact_phone);
create index if not exists idx_customer_vehicles_customer ON public.customer_vehicles USING btree (customer_id);
create index if not exists idx_customer_vehicles_next_service ON public.customer_vehicles USING btree (next_service_due);
create index if not exists idx_customer_vehicles_org ON public.customer_vehicles USING btree (org_id);
create index if not exists deal_payments_deal_idx ON public.deal_payments USING btree (deal_id, paid_at DESC);
create index if not exists deal_payments_org_idx ON public.deal_payments USING btree (org_id);
create index if not exists idx_dealer_applications_created_at ON public.dealer_applications USING btree (created_at DESC);
create index if not exists deals_enrollment_payment_id_idx ON public.deals USING btree (enrollment_payment_id);
create index if not exists deals_fleet_idx ON public.deals USING btree (fleet_vehicle_id);
create index if not exists deals_funded_at_idx ON public.deals USING btree (funded_at);
create index if not exists deals_funding_partner_idx ON public.deals USING btree (funding_partner);
create index if not exists deals_incoming_lead_id_idx ON public.deals USING btree (incoming_lead_id);
create index if not exists deals_org_idx ON public.deals USING btree (organization_id, status);
create index if not exists deals_party_idx ON public.deals USING btree (party_id);
create index if not exists idx_deals_organization_id ON public.deals USING btree (organization_id);
create index if not exists idx_detail_jobs_customer ON public.detail_jobs USING btree (customer_id);
create index if not exists idx_detail_jobs_date ON public.detail_jobs USING btree (job_date);
create index if not exists idx_detail_jobs_next_service ON public.detail_jobs USING btree (next_service_due);
create index if not exists idx_detail_jobs_org ON public.detail_jobs USING btree (org_id);
create index if not exists idx_detail_memberships_customer ON public.detail_memberships USING btree (customer_id);
create index if not exists idx_detail_memberships_org ON public.detail_memberships USING btree (org_id);
create index if not exists idx_detail_memberships_renewal ON public.detail_memberships USING btree (renewal_date);
create index if not exists dispute_clients_email_idx ON public.dispute_clients USING btree (lower(email));
create index if not exists dispute_clients_updated_idx ON public.dispute_clients USING btree (updated_at DESC);
create index if not exists do_not_rent_list_org_idx ON public.do_not_rent_list USING btree (org_id);
create index if not exists documents_org_idx ON public.documents USING btree (org_id);
create index if not exists exec_va_tasks_agent_idx ON public.exec_va_tasks USING btree (agent);
create index if not exists exec_va_tasks_category_idx ON public.exec_va_tasks USING btree (category);
create index if not exists exec_va_tasks_status_idx ON public.exec_va_tasks USING btree (status);
create index if not exists exec_va_tasks_sweep_idx ON public.exec_va_tasks USING btree (sweep_date);
create index if not exists expenses_org_idx ON public.expenses USING btree (org_id);
create index if not exists fleet_org_idx ON public.fleet USING btree (org_id);
create index if not exists fleet_retail_status_idx ON public.fleet USING btree (retail_status) WHERE (retail_status IS NOT NULL);
create index if not exists fleet_car_inspections_org_idx ON public.fleet_car_inspections USING btree (org_id);
create index if not exists form_submissions_person_idx ON public.form_submissions USING btree (person_id, created_at DESC);
create index if not exists form_submissions_slug_idx ON public.form_submissions USING btree (form_slug, created_at DESC);
create index if not exists former_customers_org_idx ON public.former_customers USING btree (org_id);
create index if not exists garage_gates_build_id_idx ON public.garage_gates USING btree (build_id, sort_order);
create index if not exists garage_history_build_id_idx ON public.garage_history USING btree (build_id, sort_order);
create index if not exists garage_ledger_build_id_idx ON public.garage_ledger USING btree (build_id, created_at);
create index if not exists garage_mods_build_id_idx ON public.garage_mods USING btree (build_id, sort_order);
create index if not exists ghl_appointments_contact_idx ON public.ghl_appointments USING btree (ghl_contact_id);
create index if not exists ghl_appointments_org_idx ON public.ghl_appointments USING btree (organization_id);
create index if not exists ghl_appointments_starts_idx ON public.ghl_appointments USING btree (starts_at DESC);
create index if not exists ghl_contacts_email_idx ON public.ghl_contacts USING btree (lower(email)) WHERE (email IS NOT NULL);
create index if not exists ghl_contacts_org_idx ON public.ghl_contacts USING btree (organization_id);
create index if not exists ghl_form_submissions_contact_idx ON public.ghl_form_submissions USING btree (ghl_contact_id);
create index if not exists ghl_form_submissions_created_idx ON public.ghl_form_submissions USING btree (created_at DESC);
create index if not exists ghl_form_submissions_org_idx ON public.ghl_form_submissions USING btree (organization_id);
create index if not exists ia_incident_idx ON public.incident_assignments USING btree (incident_id);
create index if not exists ia_pending_idx ON public.incident_assignments USING btree (status, created_at) WHERE (status = 'pending'::text);
create index if not exists incident_assignments_org_idx ON public.incident_assignments USING btree (org_id);
create index if not exists incidents_org_reported_idx ON public.incidents USING btree (org_id, reported_at DESC);
create index if not exists incidents_org_status_idx ON public.incidents USING btree (org_id, status);
create index if not exists idx_incoming_leads_open_by_assignee ON public.incoming_leads USING btree (assigned_to) WHERE (lower(COALESCE(status, 'new'::text)) <> ALL (ARRAY['closed'::text, 'lost'::text, 'archived'::text]));
create index if not exists idx_leads_affiliate_op ON public.incoming_leads USING btree (affiliate_operator_id) WHERE (affiliate_operator_id IS NOT NULL);
create index if not exists idx_leads_org_status ON public.incoming_leads USING btree (organization_id, status);
create index if not exists incoming_leads_org_agent_status_idx ON public.incoming_leads USING btree (organization_id, agent_status);
create index if not exists incoming_leads_org_created_idx ON public.incoming_leads USING btree (organization_id, created_at DESC);
create index if not exists incoming_leads_phone_org_idx ON public.incoming_leads USING btree (phone_e164, organization_id);
create index if not exists incoming_leads_program_idx ON public.incoming_leads USING btree (program);
create index if not exists incoming_leads_referred_by_lead_id_idx ON public.incoming_leads USING btree (referred_by_lead_id);
create index if not exists incoming_leads_source_campaign_idx ON public.incoming_leads USING btree (source_campaign);
create index if not exists incoming_leads_source_idx ON public.incoming_leads USING btree (source);
create index if not exists incoming_leads_utm_campaign_idx ON public.incoming_leads USING btree (utm_campaign);
create index if not exists installations_hw_idx ON public.installations USING btree (hardware_uuid);
create index if not exists installations_org_idx ON public.installations USING btree (org_id);
create index if not exists insurance_org_idx ON public.insurance USING btree (org_id);
create index if not exists intake_events_source_idx ON public.intake_events USING btree (source, record_id);
create index if not exists intake_events_unrouted_idx ON public.intake_events USING btree (created_at) WHERE (routed_at IS NULL);
create index if not exists job_dispatch_deliveries_app_idx ON public.job_dispatch_deliveries USING btree (partner_app_slug);
create index if not exists job_dispatch_deliveries_case_idx ON public.job_dispatch_deliveries USING btree (case_id);
create index if not exists job_dispatch_deliveries_status_idx ON public.job_dispatch_deliveries USING btree (status);
create index if not exists journey_checkpoint_events_journey_idx ON public.journey_checkpoint_events USING btree (journey_id);
create index if not exists journey_checkpoint_events_org_idx ON public.journey_checkpoint_events USING btree (org_id);
create index if not exists journey_checkpoints_org_idx ON public.journey_checkpoints USING btree (organization_id);
create index if not exists idx_lead_followups_lead ON public.lead_followups USING btree (lead_id);
create index if not exists idx_lead_followups_open ON public.lead_followups USING btree (status, due_at) WHERE (status = 'open'::text);
create index if not exists lto_agreements_org_idx ON public.lto_agreements USING btree (org_id);
create index if not exists maintenance_appointments_org_idx ON public.maintenance_appointments USING btree (org_id);
create index if not exists marketing_kpi_weeks_org_idx ON public.marketing_kpi_weeks USING btree (org_id);
create index if not exists marketplace_listings_active_idx ON public.marketplace_listings USING btree (active, featured DESC, created_at DESC);
create index if not exists marketplace_listings_org_idx ON public.marketplace_listings USING btree (org_id);
create index if not exists memory_entities_kind_idx ON public.memory_entities USING btree (kind);
create index if not exists memory_entities_org_idx ON public.memory_entities USING btree (org_id);
create index if not exists memory_entities_refs_idx ON public.memory_entities USING gin (external_refs);
create index if not exists memory_events_actor_idx ON public.memory_events USING btree (actor_kind, actor_id);
create index if not exists memory_events_embedding_idx ON public.memory_events USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
create index if not exists memory_events_emblocal_idx ON public.memory_events USING ivfflat (embedding_local vector_cosine_ops) WITH (lists='100');
create index if not exists memory_events_entity_idx ON public.memory_events USING btree (entity_id);
create index if not exists memory_events_org_time_idx ON public.memory_events USING btree (org_id, occurred_at DESC);
create index if not exists memory_events_source_idx ON public.memory_events USING btree (source);
create index if not exists memory_facts_active_idx ON public.memory_facts USING btree (entity_id) WHERE (valid_to IS NULL);
create index if not exists memory_facts_embedding_idx ON public.memory_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
create index if not exists memory_facts_emblocal_idx ON public.memory_facts USING ivfflat (embedding_local vector_cosine_ops) WITH (lists='100');
create index if not exists memory_facts_entity_idx ON public.memory_facts USING btree (entity_id);
create index if not exists memory_facts_org_idx ON public.memory_facts USING btree (org_id);
create index if not exists mission_items_profile_status_idx ON public.mission_items USING btree (profile_id, status);
create index if not exists mission_items_view_status_idx ON public.mission_items USING btree (view, status);
create index if not exists money_meter_events_dir_cat_idx ON public.money_meter_events USING btree (direction, category);
create index if not exists money_meter_events_org_occurred_idx ON public.money_meter_events USING btree (org_id, occurred_at DESC);
create index if not exists operation_costs_org_idx ON public.operation_costs USING btree (org_id);
create index if not exists operator_pipeline_tracker_org_idx ON public.operator_pipeline_tracker USING btree (org_id);
create unique index if not exists operator_profiles_email_unique ON public.operator_profiles USING btree (lower(customer_email));
create index if not exists operator_profiles_org_idx ON public.operator_profiles USING btree (org_id);
create index if not exists operator_rubric_scores_org_idx ON public.operator_rubric_scores USING btree (org_id);
create index if not exists operator_training_modules_track_idx ON public.operator_training_modules USING btree (track, sort_order);
create unique index if not exists operator_training_progress_uidx ON public.operator_training_progress USING btree (profile_id, module_id);
create index if not exists org_roles_user_idx ON public.org_roles USING btree (user_id);
create unique index if not exists organization_domains_hostname_key ON public.organization_domains USING btree (hostname);
create unique index if not exists organization_domains_one_primary ON public.organization_domains USING btree (org_id) WHERE is_primary;
create index if not exists organization_domains_org_idx ON public.organization_domains USING btree (org_id);
create index if not exists organization_licenses_active_idx ON public.organization_licenses USING btree (active, last_heartbeat_at);
create index if not exists organization_licenses_tier_idx ON public.organization_licenses USING btree (license_tier);
create index if not exists organizations_agency_idx ON public.organizations USING btree (parent_agency_id);
create index if not exists organizations_stripe_customer_idx ON public.organizations USING btree (stripe_customer_id);
create unique index if not exists organizations_twilio_number_idx ON public.organizations USING btree (twilio_inbound_number) WHERE (twilio_inbound_number IS NOT NULL);
create index if not exists outreach_touches_lead_idx ON public.outreach_touches USING btree (lead_id, created_at DESC);
create index if not exists outreach_touches_outcome_idx ON public.outreach_touches USING btree (outcome, created_at DESC);
create index if not exists package_entitlements_entitlement_slug_fkey_idx ON public.package_entitlements USING btree (entitlement_slug);
create index if not exists idx_parties_organization_id ON public.parties USING btree (organization_id);
create index if not exists parties_email_idx ON public.parties USING btree (lower(email));
create index if not exists parties_org_idx ON public.parties USING btree (organization_id);
create index if not exists partner_app_endpoints_active_idx ON public.partner_app_endpoints USING btree (active) WHERE (active = true);
create index if not exists partner_fleet_access_fleet_idx ON public.partner_fleet_access USING btree (fleet_id);
create index if not exists partner_fleet_access_org_idx ON public.partner_fleet_access USING btree (org_id);
create index if not exists partner_fleet_access_partner_idx ON public.partner_fleet_access USING btree (partner_user_id);
create index if not exists idx_partner_ref_pending ON public.partner_referrals USING btree (status) WHERE (status = 'pending'::text);
create index if not exists partner_referrals_affiliate_idx ON public.partner_referrals USING btree (affiliate_user_id) WHERE (affiliate_user_id IS NOT NULL);
create index if not exists partner_referrals_dest_idx ON public.partner_referrals USING btree (dest_org);
create unique index if not exists partner_referrals_event_uidx ON public.partner_referrals USING btree (handoff_event_id) WHERE (handoff_event_id IS NOT NULL);
create index if not exists partner_referrals_operator_idx ON public.partner_referrals USING btree (source_operator_id) WHERE (source_operator_id IS NOT NULL);
create index if not exists partner_referrals_org_idx ON public.partner_referrals USING btree (org_id);
create index if not exists partner_referrals_source_idx ON public.partner_referrals USING btree (source_org);
create index if not exists partner_referrals_status_idx ON public.partner_referrals USING btree (status);
create index if not exists payments_booking_idx ON public.payments USING btree (booking_id);
create index if not exists payments_case_id_fkey_idx ON public.payments USING btree (case_id);
create index if not exists payments_org_idx ON public.payments USING btree (org_id);
create index if not exists payments_profile_id_fkey_idx ON public.payments USING btree (profile_id);
create index if not exists payments_status_idx ON public.payments USING btree (status);
create unique index if not exists people_email_uniq ON public.people USING btree (lower(email)) WHERE ((email IS NOT NULL) AND (length(TRIM(BOTH FROM email)) > 0));
create index if not exists people_ghl_idx ON public.people USING btree (ghl_contact_id) WHERE (ghl_contact_id IS NOT NULL);
create unique index if not exists people_phone_uniq ON public.people USING btree (phone_digits) WHERE ((phone_digits IS NOT NULL) AND (length(phone_digits) >= 7));
create index if not exists portal_clients_partner_slug_idx ON public.portal_clients USING btree (partner_slug);
create index if not exists portal_clients_referred_by_idx ON public.portal_clients USING btree (referred_by);
create index if not exists profile_entitlement_grants_entitlement_slug_fkey_idx ON public.profile_entitlement_grants USING btree (entitlement_slug);
create index if not exists profile_entitlement_grants_granted_by_fkey_idx ON public.profile_entitlement_grants USING btree (granted_by);
create index if not exists profiles_package_id_fkey_idx ON public.profiles USING btree (package_id);
create index if not exists program_applications_email_idx ON public.program_applications USING btree (lower(email));
create index if not exists program_applications_ghl_contact_id_idx ON public.program_applications USING btree (ghl_contact_id);
create index if not exists program_applications_org_idx ON public.program_applications USING btree (org_id);
create index if not exists program_applications_status_idx ON public.program_applications USING btree (status);
create index if not exists program_audit_log_application_id_idx ON public.program_audit_log USING btree (application_id);
create index if not exists program_documents_application_idx ON public.program_documents USING btree (application_id);
create unique index if not exists program_documents_one_per_key ON public.program_documents USING btree (application_id, doc_key);
create index if not exists protocol_runs_case_idx ON public.protocol_runs USING btree (case_id);
create index if not exists protocol_runs_status_idx ON public.protocol_runs USING btree (status);
create index if not exists rental_insurance_selections_email_idx ON public.rental_insurance_selections USING btree (lower(customer_email));
create index if not exists rental_insurance_selections_org_idx ON public.rental_insurance_selections USING btree (org_id);
create index if not exists rental_ledger_booking_id_fkey_idx ON public.rental_ledger USING btree (booking_id);
create index if not exists rental_ledger_case_id_fkey_idx ON public.rental_ledger USING btree (case_id);
create index if not exists rental_ledger_created_by_fkey_idx ON public.rental_ledger USING btree (created_by);
create index if not exists rental_ledger_created_idx ON public.rental_ledger USING btree (created_at DESC);
create index if not exists rental_ledger_email_idx ON public.rental_ledger USING btree (lower(customer_email));
create index if not exists rental_ledger_org_idx ON public.rental_ledger USING btree (organization_id);
create index if not exists rental_ledger_profile_id_fkey_idx ON public.rental_ledger USING btree (profile_id);
create index if not exists rental_ledger_status_idx ON public.rental_ledger USING btree (status);
create index if not exists rental_pricing_rules_org_idx ON public.rental_pricing_rules USING btree (org_id);
create index if not exists rental_pricing_rules_tier_idx ON public.rental_pricing_rules USING btree (tier, active, match_priority DESC);
create index if not exists idx_revsplits_operator ON public.revenue_splits USING btree (operator_id);
create index if not exists revenue_splits_deal_id_idx ON public.revenue_splits USING btree (deal_id);
create index if not exists revenue_splits_org_idx ON public.revenue_splits USING btree (organization_id);
create index if not exists rewards_org_idx ON public.rewards USING btree (org_id);
create index if not exists rewards_profile_idx ON public.rewards USING btree (profile_id, created_at DESC);
create index if not exists routing_candidates_caps_idx ON public.routing_candidates USING gin (capability_tags);
create index if not exists routing_candidates_org_idx ON public.routing_candidates USING btree (org_id);
create index if not exists routing_candidates_status_idx ON public.routing_candidates USING btree (status);
create index if not exists routing_candidates_verts_idx ON public.routing_candidates USING gin (vertical_slugs);
create index if not exists services_org_idx ON public.services USING btree (org_id);
create index if not exists shops_mechanics_cleaning_org_idx ON public.shops_mechanics_cleaning USING btree (org_id);
create index if not exists signup_invites_unused_idx ON public.signup_invites USING btree (expires_at) WHERE (used_at IS NULL);
create index if not exists sync_events_sync_record_id_fkey_idx ON public.sync_events USING btree (sync_record_id);
create index if not exists idx_team_onboarding_created_at ON public.team_onboarding USING btree (created_at DESC);
create index if not exists tickets_org_idx ON public.tickets USING btree (org_id);
create index if not exists time_clock_entries_org_idx ON public.time_clock_entries USING btree (org_id);
create index if not exists time_clock_open_idx ON public.time_clock_entries USING btree (user_id) WHERE (clock_out IS NULL);
create index if not exists time_clock_user_idx ON public.time_clock_entries USING btree (user_id, clock_in DESC);
create index if not exists tmmt_token_events_org_created_idx ON public.tmmt_token_events USING btree (org_id, created_at DESC);
create index if not exists tmmt_token_ledger_device_idx ON public.tmmt_token_ledger USING btree (device_id, created_at DESC);
create index if not exists training_module_progress_org_idx ON public.training_module_progress USING btree (org_id);
create index if not exists unit_locations_org_idx ON public.unit_locations USING btree (org_id);
create index if not exists unit_locations_unit_time_idx ON public.unit_locations USING btree (unit_id, recorded_at DESC);
create index if not exists units_org_status_idx ON public.units USING btree (org_id, status);
create index if not exists vehicle_damage_email_idx ON public.vehicle_damage_reports USING btree (lower(customer_email));
create index if not exists vehicle_damage_reports_booking_id_fkey_idx ON public.vehicle_damage_reports USING btree (booking_id);
create index if not exists vehicle_damage_reports_case_id_fkey_idx ON public.vehicle_damage_reports USING btree (case_id);
create index if not exists vehicle_damage_reports_org_idx ON public.vehicle_damage_reports USING btree (org_id);
create index if not exists vehicle_damage_reports_reported_by_fkey_idx ON public.vehicle_damage_reports USING btree (reported_by);
create index if not exists vehicle_damage_reports_vehicle_id_fkey_idx ON public.vehicle_damage_reports USING btree (vehicle_id);
create index if not exists vehicle_events_org_idx ON public.vehicle_events USING btree (org_id);
create index if not exists vehicle_handover_org_idx ON public.vehicle_handover USING btree (org_id);
create index if not exists vehicle_media_booking_id_fkey_idx ON public.vehicle_media USING btree (booking_id);
create index if not exists vehicle_media_case_id_fkey_idx ON public.vehicle_media USING btree (case_id);
create index if not exists vehicle_media_email_idx ON public.vehicle_media USING btree (lower(customer_email));
create index if not exists vehicle_media_org_idx ON public.vehicle_media USING btree (org_id);
create index if not exists vehicle_media_uploaded_by_fkey_idx ON public.vehicle_media USING btree (uploaded_by);
create index if not exists vehicle_media_vehicle_id_fkey_idx ON public.vehicle_media USING btree (vehicle_id);
create index if not exists vehicle_onboarding_inspections_org_idx ON public.vehicle_onboarding_inspections USING btree (org_id);
create index if not exists vehicles_org_idx ON public.vehicles USING btree (org_id);
create index if not exists vendor_files_org_idx ON public.vendor_files USING btree (org_id);
create index if not exists vendor_job_updates_org_idx ON public.vendor_job_updates USING btree (org_id);
create index if not exists vendor_jobs_case_idx ON public.vendor_jobs USING btree (case_id);
create index if not exists vendor_jobs_org_idx ON public.vendor_jobs USING btree (org_id);
create index if not exists vendor_jobs_status_idx ON public.vendor_jobs USING btree (status);
create index if not exists vendor_jobs_vendor_idx ON public.vendor_jobs USING btree (vendor_id);
create index if not exists vendors_service_verticals_gin ON public.vendors USING gin (service_verticals);
create index if not exists ventures_org_idx ON public.ventures USING btree (org_id);
create index if not exists verticals_org_idx ON public.verticals USING btree (org_id);
create index if not exists waitlist_org_idx ON public.waitlist USING btree (org_id);
create index if not exists work_assignments_candidate_idx ON public.work_assignments USING btree (candidate_id);
create index if not exists work_assignments_case_idx ON public.work_assignments USING btree (case_id);
create index if not exists work_assignments_org_idx ON public.work_assignments USING btree (org_id);

-- ============ 7. VIEWS ============
create or replace view public.client_renter_status with (security_invoker=on) as
 SELECT sync_record_id,
    ghl_contact_id,
    ghl_pipeline_name,
    ghl_stage,
    canonical_stage,
    customer_name,
    customer_email,
    case_id,
    updated_at
   FROM renter_pipeline_status r
  WHERE customer_email IS NOT NULL AND lower(customer_email) = lower(current_profile_email());

create or replace view public.incident_assignments_v with (security_invoker=on) as
 SELECT id,
    org_id,
    incident_id,
    unit_id,
    assigned_by_kind,
    assigned_by,
    override_weight,
    reasoning_json,
    status,
    created_at,
    locked_at,
        CASE
            WHEN status = 'pending'::text AND created_at < (now() - '00:00:30'::interval) THEN 'locked'::text
            ELSE status
        END AS effective_status
   FROM incident_assignments ia;

create or replace view public.operator_scoreboard with (security_invoker=on) as
 SELECT affiliate_user_id,
    count(*) AS referrals,
    count(*) FILTER (WHERE status = ANY (ARRAY['accepted'::text, 'completed'::text, 'paid'::text])) AS engaged,
    count(*) FILTER (WHERE status = ANY (ARRAY['completed'::text, 'paid'::text])) AS approvals,
    COALESCE(sum(commission_cents) FILTER (WHERE status = ANY (ARRAY['completed'::text, 'paid'::text])), 0::bigint) AS commission_cents,
    (count(*) * 10 + count(*) FILTER (WHERE status = ANY (ARRAY['accepted'::text, 'completed'::text, 'paid'::text])) * 15 + count(*) FILTER (WHERE status = ANY (ARRAY['completed'::text, 'paid'::text])) * 75 + COALESCE(sum(commission_cents) FILTER (WHERE status = ANY (ARRAY['completed'::text, 'paid'::text])), 0::bigint) / 100)::integer AS points
   FROM partner_referrals
  WHERE affiliate_user_id IS NOT NULL
  GROUP BY affiliate_user_id;

create or replace view public.operator_seats with (security_invoker=on) as
 SELECT count(*) FILTER (WHERE ((metadata ->> 'seat_paid'::text)::boolean) IS TRUE) AS seats_taken,
    100 - count(*) FILTER (WHERE ((metadata ->> 'seat_paid'::text)::boolean) IS TRUE) AS seats_remaining
   FROM operator_profiles;

create or replace view public.renter_pipeline_status with (security_invoker=on) as
 SELECT id AS sync_record_id,
    ghl_contact_id,
    ghl_opportunity_id,
    ghl_pipeline_name,
    ghl_stage,
    canonical_stage,
    business_line,
    customer_name,
    customer_email,
    customer_phone,
    case_id,
    airtable_record_id,
    verified_at,
    updated_at
   FROM crm_sync_records r
  WHERE sync_status = 'verified'::sync_record_status;

create or replace view public.v_affiliate_open_market with (security_invoker=on) as
 SELECT id AS referral_id,
    source_org,
    dest_org,
    reason AS vertical,
    status,
    commission_cents,
    created_at,
    consent_captured_at IS NOT NULL AS consent_ok
   FROM partner_referrals pr
  WHERE status = 'pending'::text AND consent_captured_at IS NOT NULL;

create or replace view public.v_bills_dashboard with (security_invoker=on) as
 SELECT scope,
    name,
    vendor,
    category,
    amount,
    cycle,
    status,
    next_due_date,
        CASE
            WHEN next_due_date IS NULL THEN NULL::integer
            ELSE next_due_date - CURRENT_DATE
        END AS days_until_due,
        CASE
            WHEN status <> 'Active'::text THEN 'inactive'::text
            WHEN next_due_date IS NULL THEN 'NO DUE DATE â€” set it'::text
            WHEN next_due_date < CURRENT_DATE THEN 'OVERDUE'::text
            WHEN next_due_date <= (CURRENT_DATE + 7) THEN 'due this week'::text
            ELSE 'upcoming'::text
        END AS flag,
    auto_pay,
    payment_method,
    notes,
    id
   FROM bills
  ORDER BY (
        CASE
            WHEN status = 'Active'::text THEN 0
            ELSE 1
        END), next_due_date, scope, amount DESC;

create or replace view public.v_call_sheet_today with (security_invoker=on) as
 WITH known_customers AS (
         SELECT "right"(regexp_replace(COALESCE(active_customers.contact_phone, ''::text), '\D'::text, ''::text, 'g'::text), 10) AS d10
           FROM active_customers
        UNION
         SELECT "right"(regexp_replace(COALESCE(former_customers.contact_phone, ''::text), '\D'::text, ''::text, 'g'::text), 10) AS "right"
           FROM former_customers
        ), eligible AS (
         SELECT b.lead_id,
            b.contact_name,
            b.phone10,
            b.email,
            b.age_band,
            b.age_days,
            b.is_jv,
            b.is_ad,
            b.voice_ai_touched,
            b.assigned_to,
            b.rent_tier,
            b.rent_ready,
            b.is_dnc,
            b.is_dnr,
            b.contact_gate,
            row_number() OVER (PARTITION BY b.phone10 ORDER BY (b.contact_gate = 'LANE_DIRECT'::text) DESC, b.rent_ready DESC NULLS LAST, b.age_days) AS dup_rank
           FROM v_outreach_book b
          WHERE (b.contact_gate = 'LANE_DIRECT'::text OR b.contact_gate = 'LANE_REENGAGE'::text AND b.rent_ready) AND NOT (EXISTS ( SELECT 1
                   FROM known_customers k
                  WHERE k.d10 = b.phone10 AND length(b.phone10) = 10))
        )
 SELECT lead_id,
    phone10,
    contact_name,
    email,
        CASE
            WHEN contact_gate = 'LANE_DIRECT'::text THEN 'FRESH_SCREEN'::text
            ELSE 'REENGAGE'::text
        END AS lane,
    rent_tier,
    rent_ready,
    age_days,
    voice_ai_touched,
    assigned_to,
    ( SELECT count(*) AS count
           FROM outreach_touches t
          WHERE t.lead_id = eligible.lead_id) AS prior_touches
   FROM eligible
  WHERE dup_rank = 1;

create or replace view public.v_collections_truth with (security_invoker=on) as
 WITH base AS (
         SELECT COALESCE(NULLIF(cp.customer_name, ''::text), cp.customer) AS customer,
            cp.customer_phone_number AS phone,
            cp.payment_status,
            cp.last_payment_date,
            cp.payment_plan,
            cp.vehicle_name,
                CASE
                    WHEN TRIM(BOTH FROM COALESCE(cp.amout_past_due, ''::text)) ~ '^\$?\s*[0-9,]+(\.[0-9]{1,2})?$'::text THEN replace(regexp_replace(TRIM(BOTH FROM cp.amout_past_due), '[$,\s]'::text, ''::text, 'g'::text), ','::text, ''::text)::numeric
                    ELSE NULL::numeric
                END AS past_due_stated,
            COALESCE(cp.amout_past_due, ''::text) <> ''::text AND TRIM(BOTH FROM cp.amout_past_due) !~ '^\$?\s*[0-9,]+(\.[0-9]{1,2})?$'::text AS junk_past_due_field,
            cp.amount AS amount_field,
            split_part(COALESCE(cp.notes, ''::text), '
'::text, 1) AS latest_note,
            cp.id,
            (EXISTS ( SELECT 1
                   FROM do_not_contact_numbers d
                  WHERE d.phone10 = "right"(regexp_replace(COALESCE(cp.customer_phone_number, ''::text), '\D'::text, ''::text, 'g'::text), 10) AND length(regexp_replace(COALESCE(cp.customer_phone_number, ''::text), '\D'::text, ''::text, 'g'::text)) >= 10)) AS on_dnc
           FROM customer_payments cp
        )
 SELECT customer,
    phone,
    payment_status,
    last_payment_date,
    payment_plan,
    vehicle_name,
    past_due_stated,
    amount_field,
    COALESCE(past_due_stated,
        CASE
            WHEN payment_status ~~* '%overdue%'::text THEN amount_field
            ELSE NULL::numeric
        END) AS best_past_due,
    junk_past_due_field,
    latest_note ~* 'no past due'::text AS note_says_no_balance,
    latest_note ~* '--\s*paid\s*$'::text AS note_says_paid,
    customer ~~* '%bibbs%'::text AS hands_off_namesake,
        CASE
            WHEN on_dnc THEN 'HOLD â€” DNC/opt-out: no text, no call (written only, âš–ï¸)'::text
            WHEN customer ~~* '%bibbs%'::text THEN 'HOLD â€” hands-off (namesake check)'::text
            WHEN latest_note ~* 'no past due'::text THEN 'HOLD â€” latest note: no balance'::text
            WHEN latest_note ~* '--\s*paid\s*$'::text THEN 'VERIFY â€” latest note says paid'::text
            WHEN payment_status ~~* '%paid%'::text THEN 'EXCLUDE â€” status paid'::text
            WHEN COALESCE(past_due_stated,
            CASE
                WHEN payment_status ~~* '%overdue%'::text THEN amount_field
                ELSE NULL::numeric
            END) IS NULL THEN 'HOLD â€” no reliable amount'::text
            WHEN payment_status ~~* '%overdue%'::text OR payment_status IS NULL AND past_due_stated IS NOT NULL THEN 'CHASE'::text
            ELSE 'EXCLUDE'::text
        END AS verdict,
    latest_note,
    id,
    on_dnc
   FROM base;

create or replace view public.v_enforcement_radar with (security_invoker=on) as
 SELECT ae.ts,
    ae.organization_id,
    o.name AS org_name,
    ae.action,
    ae.hardware_uuid,
    ae.ip,
    ae.payload ->> 'mode'::text AS mode,
    (ae.payload ->> 'enforced'::text)::boolean AS enforced
   FROM audit_events ae
     LEFT JOIN organizations o ON o.id = ae.organization_id
  WHERE ae.action ~~ 'violation:%'::text OR ae.action = 'checkin_ok'::text
  ORDER BY ae.ts DESC;

create or replace view public.v_federation_handoffs with (security_invoker=on) as
 SELECT id,
    created_at,
    source_org,
    dest_org,
    source_contact_ref,
    reason,
    status,
    consent_captured_at IS NOT NULL AS consent_ok,
    consent_captured_at,
    consent_channel,
    commission_cents,
    accepted_at,
    completed_at,
    paid_at
   FROM partner_referrals r
  ORDER BY created_at DESC;

create or replace view public.v_lead_provenance with (security_invoker=on) as
 WITH l AS (
         SELECT incoming_leads.id AS lead_id,
            "right"(regexp_replace(COALESCE(incoming_leads.phone_e164, incoming_leads.phone_text, incoming_leads.phone::text, ''::text), '\D'::text, ''::text, 'g'::text), 10) AS d10,
            incoming_leads.created_on,
            incoming_leads.created_at,
            incoming_leads.opted_out,
            incoming_leads.assigned_to
           FROM incoming_leads
        ), g AS (
         SELECT "right"(regexp_replace(COALESCE(ghl_contacts.phone, ''::text), '\D'::text, ''::text, 'g'::text), 10) AS d10,
            bool_or('jv leads'::text = ANY (ghl_contacts.tags)) AS is_jv,
            bool_or('(uber & lyft) lead from ads'::text = ANY (ghl_contacts.tags)) AS is_ad,
            bool_or('voice ai'::text = ANY (ghl_contacts.tags)) AS voice_ai_touched,
            bool_or('waitlist'::text = ANY (ghl_contacts.tags)) AS is_waitlist
           FROM ghl_contacts
          WHERE length("right"(regexp_replace(COALESCE(ghl_contacts.phone, ''::text), '\D'::text, ''::text, 'g'::text), 10)) = 10
          GROUP BY ("right"(regexp_replace(COALESCE(ghl_contacts.phone, ''::text), '\D'::text, ''::text, 'g'::text), 10))
        )
 SELECT l.lead_id,
    l.d10,
    l.created_on,
    l.opted_out,
    l.assigned_to,
    COALESCE(g.is_jv, false) AS is_jv,
    COALESCE(g.is_ad, false) AS is_ad,
    COALESCE(g.voice_ai_touched, false) AS voice_ai_touched,
    COALESCE(g.is_waitlist, false) AS is_waitlist,
    g.d10 IS NOT NULL AS matched_ghl,
        CASE
            WHEN l.created_on IS NULL THEN NULL::integer
            ELSE EXTRACT(day FROM now() - l.created_on)::integer
        END AS age_days,
        CASE
            WHEN l.created_on IS NULL THEN 'UNKNOWN_AGE'::text
            WHEN l.created_on > (now() - '90 days'::interval) THEN 'FRESH'::text
            WHEN l.created_on > (now() - '365 days'::interval) THEN 'DORMANT'::text
            ELSE 'COLD_1YR_PLUS'::text
        END AS age_band
   FROM l
     LEFT JOIN g ON g.d10 = l.d10 AND length(l.d10) = 10;

create or replace view public.v_license_audit with (security_invoker=on) as
 SELECT o.id AS organization_id,
    o.name,
    o.kind,
    o.partner_app_slug,
    o.billing_status,
    ol.license_tier,
    ol.active,
    ol.license_key_hash IS NOT NULL AS has_key,
    ol.hardware_uuid IS NOT NULL AS hw_bound,
    ol.install_token_hash IS NOT NULL AS has_install_token,
    ol.install_token_used,
    ol.valid_until,
    ol.last_heartbeat_at,
        CASE
            WHEN o.kind = ANY (ARRAY['tmmt'::text, 'aixmos'::text]) THEN 'internal'::text
            ELSE 'external'::text
        END AS ownership,
    COALESCE(NULLIF(concat_ws(', '::text,
        CASE
            WHEN COALESCE(ol.active, false) AND ol.license_key_hash IS NULL THEN 'NO_KEY'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(ol.active, false) AND ol.hardware_uuid IS NULL THEN 'NOT_HW_BOUND'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(ol.active, false) AND ol.last_heartbeat_at IS NULL THEN 'NO_HEARTBEAT'::text
            ELSE NULL::text
        END,
        CASE
            WHEN ol.last_heartbeat_at IS NOT NULL AND ol.last_heartbeat_at < (now() - '7 days'::interval) THEN 'STALE_HEARTBEAT'::text
            ELSE NULL::text
        END,
        CASE
            WHEN ol.valid_until IS NOT NULL AND ol.valid_until < now() THEN 'EXPIRED'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(ol.active, false) AND (o.billing_status <> ALL (ARRAY['active'::text, 'trialing'::text])) THEN 'BILLING_LAPSED'::text
            ELSE NULL::text
        END), ''::text),
        CASE
            WHEN COALESCE(ol.active, false) THEN 'OK'::text
            ELSE 'INACTIVE'::text
        END) AS risk_flags
   FROM organizations o
     LEFT JOIN organization_licenses ol ON ol.organization_id = o.id;

create or replace view public.v_next_credit_partner as
 SELECT slug,
    name,
    email,
    priority,
    active
   FROM partners
  WHERE active AND type = 'credit'::text
  ORDER BY priority, created_at;

create or replace view public.v_operator_360 with (security_invoker=on) as
 WITH mtot AS (
         SELECT count(*)::numeric AS n
           FROM operator_training_modules m
          WHERE COALESCE(m.active, true)
        )
 SELECT op.id AS operator_profile_id,
    op.profile_id,
    op.customer_email AS email,
    pt.operator_name,
    op.level,
    op.rubric_score,
    op.revenue_share_pct,
    op.license_fee_cents,
    op.ghl_pipeline_stage,
    op.certified_at,
    op.certified_at IS NOT NULL AS is_certified,
    pt.pipeline_stage,
    pt.current_module_number,
    pt.action_step_complete,
    pt.credit_score_current,
    pt.credit_score_target,
    pt.vehicle_assigned,
    pt.vehicle_status,
    pt.last_checkin_at,
    pt.next_checkin_at,
    (( SELECT mtot.n
           FROM mtot))::integer AS modules_total,
    (( SELECT count(*) AS count
           FROM operator_training_progress pr
          WHERE pr.profile_id = op.profile_id AND pr.percent_complete >= 100))::integer AS modules_completed,
        CASE
            WHEN (( SELECT mtot.n
               FROM mtot)) > 0::numeric THEN round(100.0 * (( SELECT count(*) AS count
               FROM operator_training_progress pr
              WHERE pr.profile_id = op.profile_id AND pr.percent_complete >= 100))::numeric / (( SELECT mtot.n
               FROM mtot)))
            ELSE 0::numeric
        END AS program_pct_complete,
        CASE
            WHEN op.certified_at IS NOT NULL THEN 'CERTIFIED â€” full unlock'::text
            WHEN (( SELECT mtot.n
               FROM mtot)) > 0::numeric AND (( SELECT count(*) AS count
               FROM operator_training_progress pr
              WHERE pr.profile_id = op.profile_id AND pr.percent_complete >= 100))::numeric >= (( SELECT mtot.n
               FROM mtot)) THEN 'READY TO CERTIFY (100%)'::text
            ELSE 'IN PROGRAM'::text
        END AS unlock_status
   FROM operator_profiles op
     LEFT JOIN operator_pipeline_tracker pt ON lower(pt.operator_email) = lower(op.customer_email);

create or replace view public.v_operator_network with (security_invoker=on) as
 SELECT id AS operator_id,
    customer_email,
    level::text AS level,
    revenue_share_pct,
    ( SELECT al.code
           FROM affiliate_links al
          WHERE al.operator_id = op.id AND al.active
         LIMIT 1) AS affiliate_code,
    ( SELECT count(*) AS count
           FROM operator_va_assignments va
          WHERE va.operator_id = op.id AND va.active) AS vas_assigned,
    COALESCE(( SELECT sum(rs.operator_cents) AS sum
           FROM revenue_splits rs
          WHERE rs.operator_id = op.id AND (rs.status = ANY (ARRAY['pending'::text, 'paid'::text]))), 0::bigint) AS operator_lifetime_cents
   FROM operator_profiles op;

create or replace view public.v_operator_watchtower with (security_invoker=on) as
 SELECT license_id,
    operator_name,
    operator_email,
    operator_city,
    tier,
    active,
    paid_in_full,
    activated_at,
    last_heartbeat,
        CASE
            WHEN last_heartbeat IS NULL THEN 'never_pinged'::text
            WHEN last_heartbeat < (now() - '14 days'::interval) THEN 'critical'::text
            WHEN last_heartbeat < (now() - '8 days'::interval) THEN 'overdue'::text
            ELSE 'healthy'::text
        END AS heartbeat_status,
    revoked_at,
    revoke_reason
   FROM hailmary_licenses
  ORDER BY activated_at DESC;

create or replace view public.v_outreach_book with (security_invoker=on) as
 SELECT p.lead_id,
    q.contact_name,
    p.d10 AS phone10,
    q.email,
    p.age_band,
    p.age_days,
    p.is_jv,
    p.is_ad,
    p.voice_ai_touched,
    p.assigned_to,
    q.tier AS rent_tier,
    q.callable AS rent_ready,
    q.is_dnc,
    q.is_dnr,
        CASE
            WHEN length(p.d10) <> 10 THEN 'BLOCK_NO_PHONE'::text
            WHEN q.is_dnc THEN 'BLOCK_DNC'::text
            WHEN p.opted_out THEN 'BLOCK_OPTED_OUT'::text
            WHEN p.is_jv THEN 'BLOCK_JV_NOT_OUR_CONSENT'::text
            WHEN NOT p.matched_ghl THEN 'BLOCK_NO_PROVENANCE'::text
            WHEN p.age_band = 'FRESH'::text THEN 'LANE_DIRECT'::text
            WHEN p.age_band = 'DORMANT'::text THEN 'LANE_REENGAGE'::text
            ELSE 'LANE_REPERMISSION'::text
        END AS contact_gate
   FROM v_lead_provenance p
     JOIN v_prequalified_leads q ON q.lead_id = p.lead_id;

create or replace view public.v_prequalified_leads with (security_invoker=on) as
 WITH l AS (
         SELECT incoming_leads.id AS lead_id,
            incoming_leads.contact_name,
            incoming_leads.email,
            incoming_leads.created_at,
            incoming_leads.source,
            lower(TRIM(BOTH FROM COALESCE(incoming_leads.email, ''::text))) AS em,
            "right"(regexp_replace(COALESCE(incoming_leads.phone_e164, incoming_leads.phone_text, incoming_leads.phone::text, ''::text), '\D'::text, ''::text, 'g'::text), 10) AS d10
           FROM incoming_leads
        ), b AS (
         SELECT lower(TRIM(BOTH FROM COALESCE(background_checks.email, ''::text))) AS em,
            "right"(regexp_replace(COALESCE(background_checks.phone_number, ''::text), '\D'::text, ''::text, 'g'::text), 10) AS d10,
            background_checks.eligibility_status,
            background_checks.verificaton_form_submitted AS verified_form,
            background_checks.own_insurance,
            background_checks.date_verified,
            background_checks.review_notes
           FROM background_checks
        ), joined AS (
         SELECT DISTINCT ON (l.lead_id) l.lead_id,
            l.contact_name,
            l.email,
            l.d10,
            l.created_at,
            l.source,
            b.eligibility_status,
            b.verified_form,
            b.own_insurance,
            b.date_verified,
            b.review_notes
           FROM l
             LEFT JOIN b ON b.d10 = l.d10 AND length(l.d10) = 10 OR b.em = l.em AND l.em <> ''::text
          ORDER BY l.lead_id, (b.eligibility_status = 'Eligible'::text) DESC NULLS LAST, b.date_verified DESC NULLS LAST
        )
 SELECT lead_id,
    contact_name,
    d10 AS phone10,
    email,
    source,
    created_at,
    eligibility_status,
    verified_form,
    own_insurance,
    date_verified,
    review_notes,
    (EXISTS ( SELECT 1
           FROM do_not_contact_numbers d
          WHERE "right"(regexp_replace(COALESCE(d.phone10, ''::text), '\D'::text, ''::text, 'g'::text), 10) = j.d10 AND length(j.d10) = 10)) AS is_dnc,
    (EXISTS ( SELECT 1
           FROM do_not_rent_list r
          WHERE "right"(regexp_replace(COALESCE(r.contact_phone, ''::text), '\D'::text, ''::text, 'g'::text), 10) = j.d10 AND length(j.d10) = 10)) AS is_dnr,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM do_not_contact_numbers d
              WHERE "right"(regexp_replace(COALESCE(d.phone10, ''::text), '\D'::text, ''::text, 'g'::text), 10) = j.d10 AND length(j.d10) = 10)) THEN 'BLOCKED_DNC'::text
            WHEN (EXISTS ( SELECT 1
               FROM do_not_rent_list r
              WHERE "right"(regexp_replace(COALESCE(r.contact_phone, ''::text), '\D'::text, ''::text, 'g'::text), 10) = j.d10 AND length(j.d10) = 10)) THEN 'BLOCKED_DNR'::text
            WHEN length(d10) <> 10 THEN 'NO_PHONE'::text
            WHEN eligibility_status = 'Eligible'::text AND verified_form IS TRUE THEN 'A_CALL_NOW'::text
            WHEN eligibility_status = 'Eligible'::text THEN 'B_ELIGIBLE_UNVERIFIED'::text
            WHEN eligibility_status = 'Need Manager''s Review'::text THEN 'C_NEEDS_REVIEW'::text
            WHEN eligibility_status = 'out of radius'::text THEN 'D_OUT_OF_RADIUS'::text
            WHEN eligibility_status = ANY (ARRAY['Not Eligible'::text, 'Not found'::text]) THEN 'E_DISQUALIFIED'::text
            ELSE 'F_UNSCREENED'::text
        END AS tier,
    length(d10) = 10 AND eligibility_status = 'Eligible'::text AND NOT (EXISTS ( SELECT 1
           FROM do_not_contact_numbers d
          WHERE "right"(regexp_replace(COALESCE(d.phone10, ''::text), '\D'::text, ''::text, 'g'::text), 10) = j.d10)) AND NOT (EXISTS ( SELECT 1
           FROM do_not_rent_list r
          WHERE "right"(regexp_replace(COALESCE(r.contact_phone, ''::text), '\D'::text, ''::text, 'g'::text), 10) = j.d10)) AS callable
   FROM joined j;

create or replace view public.v_trap_money_flywheel as
 SELECT 'funding'::text AS stage,
    d.funded_at AS event_date,
    NULL::uuid AS operator_id,
    d.vehicle_label AS customer,
    COALESCE(d.referral_fee_cents, 0::bigint) AS amount_cents,
    d.status::text AS status,
    'deals.funding'::text AS source
   FROM deals d
  WHERE d.funded_amount_cents IS NOT NULL
UNION ALL
 SELECT 'vehicle_sale'::text AS stage,
    d.closed_at AS event_date,
    NULL::uuid AS operator_id,
    d.vehicle_label AS customer,
    round(COALESCE(d.sale_price, 0::numeric) * 100::numeric)::bigint AS amount_cents,
    d.status::text AS status,
    'deals.sale'::text AS source
   FROM deals d
  WHERE d.sale_price IS NOT NULL
UNION ALL
 SELECT 'referral'::text AS stage,
    pr.completed_at AS event_date,
    COALESCE(pr.source_operator_id, pr.affiliate_user_id) AS operator_id,
    pr.source_contact_ref AS customer,
    COALESCE(pr.commission_cents, 0)::bigint AS amount_cents,
    pr.status,
    'partner_referrals'::text AS source
   FROM partner_referrals pr
UNION ALL
 SELECT 'rental'::text AS stage,
    COALESCE(rl.completed_at, rl.created_at) AS event_date,
    rl.created_by AS operator_id,
    COALESCE(rl.customer_name, rl.customer_email) AS customer,
    COALESCE(rl.amount_cents, 0)::bigint AS amount_cents,
    rl.status::text AS status,
    'rental_ledger'::text AS source
   FROM rental_ledger rl
UNION ALL
 SELECT 'lease_to_own'::text AS stage,
    lto.signed_at AS event_date,
    NULL::uuid AS operator_id,
    lto.vin AS customer,
    (COALESCE(lto.weekly_buyout_cents, 0) * COALESCE(lto.term_weeks, 0))::bigint AS amount_cents,
    lto.status,
    'lto_agreements'::text AS source
   FROM lto_agreements lto
UNION ALL
 SELECT 'product_sale'::text AS stage,
    il.closed_at AS event_date,
    COALESCE(il.affiliate_operator_id, il.assigned_to) AS operator_id,
    il.contact_name AS customer,
    COALESCE(il.sku_price_cents, 0)::bigint AS amount_cents,
    il.status,
    'incoming_leads'::text AS source
   FROM incoming_leads il
  WHERE il.closed_at IS NOT NULL;

create or replace view public.v_trap_money_summary as
 SELECT v_trap_money_flywheel.stage,
    count(*) AS events,
    round(sum(v_trap_money_flywheel.amount_cents) / 100.0, 2) AS dollars
   FROM v_trap_money_flywheel
  GROUP BY v_trap_money_flywheel.stage
UNION ALL
 SELECT 'TOTAL â€” toward the houses'::text AS stage,
    count(*) AS events,
    round(sum(v_trap_money_flywheel.amount_cents) / 100.0, 2) AS dollars
   FROM v_trap_money_flywheel;

-- ============ 8. FUNCTIONS ============
-- 140 functions, 99 of them SECURITY DEFINER. Grants are in section 11.

CREATE OR REPLACE FUNCTION public.accept_handoff(p_referral_id uuid)
 RETURNS partner_referrals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.partner_referrals;
begin
  -- Authorization guard.
  if auth.role() is distinct from 'service_role'
     and auth.role() is not null
     and not public.is_staff()
     and auth.uid() is distinct from
         (select affiliate_user_id from public.partner_referrals where id = p_referral_id) then
    raise exception 'accept_handoff: only the assigned affiliate or staff may accept'
      using errcode = '42501';
  end if;

  update public.partner_referrals
     set status      = 'accepted',
         accepted_at = now()
   where id = p_referral_id
  returning * into v_row;   -- enforce_handoff_consent() raises if no consent

  if v_row.id is null then raise exception 'referral % not found', p_referral_id; end if;
  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.acting_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (
      select r.org_id
      from public.org_roles r
      where r.user_id = auth.uid()
      -- Prefer a non-house org: someone carrying both an explicit operator
      -- role and house membership is acting as the operator.
      order by (r.org_id = '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid) asc
      limit 1
    ),
    (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id is not null
        and p.role::text in ('admin', 'internal_team')
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.agency_pct_from_tier(p_tier partner_revenue_split_tier)
 RETURNS smallint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select (100 - public.partner_pct_from_tier(p_tier))::smallint;
$function$
;

CREATE OR REPLACE FUNCTION public.agent_claim_jobs(p_worker text, p_limit integer DEFAULT 5)
 RETURNS TABLE(job_id bigint, agent_slug text, model text, temperature numeric, source_table text, record_id text, prompt text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'agent_claim_jobs: workers only' using errcode = '42501';
  end if;
  return query
  with picked as (
    select j.id from public.agent_jobs j
    join public.agent_definitions d on d.slug = j.agent_slug and d.active
    where j.status = 'queued' and j.attempts < d.max_attempts
    order by j.created_at
    limit greatest(1, least(coalesce(p_limit, 5), 50))
    for update of j skip locked
  )
  update public.agent_jobs j
     set status = 'running', attempts = j.attempts + 1,
         claimed_by = p_worker, claimed_at = now()
    from picked p, public.agent_definitions d
   where j.id = p.id and d.slug = j.agent_slug
  returning j.id, j.agent_slug, d.model, d.temperature, j.source_table, j.record_id, j.prompt;
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_complete_job(p_job_id bigint, p_response text, p_error text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare j record; d record; v_written boolean := false;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'agent_complete_job: workers only' using errcode = '42501';
  end if;

  select * into j from public.agent_jobs where id = p_job_id;
  if not found then raise exception 'agent_complete_job: job % not found', p_job_id; end if;
  select * into d from public.agent_definitions where slug = j.agent_slug;

  if p_error is not null then
    update public.agent_jobs
       set status = case when attempts >= d.max_attempts then 'failed' else 'queued' end,
           error = left(p_error, 2000), finished_at = now()
     where id = p_job_id;
    return jsonb_build_object('job', p_job_id, 'status', 'error', 'error', left(p_error, 200));
  end if;

  if d.target_field is not null and d.source_table = j.source_table then
    execute format('update public.%I set %I = $1 where id = $2::uuid', d.source_table, d.target_field)
      using btrim(coalesce(p_response, '')), j.record_id;
    v_written := true;
  end if;

  update public.agent_jobs
     set status = 'done', response = p_response, error = null, finished_at = now()
   where id = p_job_id;

  return jsonb_build_object('job', p_job_id, 'status', 'done', 'wrote_field', v_written);
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d record; v_row jsonb := to_jsonb(new); v_changed boolean;
begin
  for d in
    select * from public.agent_definitions
    where active
      and source_table = tg_table_name
      and (fire_on = 'both'
           or (fire_on = 'insert' and tg_op = 'INSERT')
           or (fire_on = 'update' and tg_op = 'UPDATE'))
  loop
    if d.only_when_null is not null
       and coalesce(v_row ->> d.only_when_null, '') <> '' then
      continue;
    end if;

    if tg_op = 'UPDATE' and d.watch_fields is not null then
      select bool_or(to_jsonb(old) ->> f is distinct from v_row ->> f)
        into v_changed from unnest(d.watch_fields) f;
      if not coalesce(v_changed, false) then
        continue;
      end if;
    end if;

    insert into public.agent_jobs (agent_slug, source_table, record_id, prompt, org_id)
    values (
      d.slug, tg_table_name, (v_row ->> 'id'),
      public.agent_render_prompt(d.prompt_template, v_row),
      case when v_row ? 'org_id' then (v_row ->> 'org_id')::uuid else null end
    );
  end loop;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.agent_open_load(p_profile uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from public.incoming_leads
  where assigned_to = p_profile
    and lower(coalesce(status,'new')) not in ('closed','lost','archived')
    and coalesce(opted_out,false) = false
$function$
;

CREATE OR REPLACE FUNCTION public.agent_render_prompt(p_template text, p_row jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare k text; v text; out_text text := p_template;
begin
  for k in select jsonb_object_keys(p_row) loop
    v := coalesce(nullif(p_row ->> k, ''), '(blank)');
    out_text := replace(out_text, '{{' || k || '}}', v);
  end loop;
  return out_text;
end $function$
;

CREATE OR REPLACE FUNCTION public.app_auth_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT nullif(trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')), '');
$function$
;

CREATE OR REPLACE FUNCTION public.assign_lead_idle(p_lead uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_org uuid; v_closer uuid;
begin
  select organization_id into v_org from incoming_leads where id = p_lead for update;
  if v_org is null then return null; end if;
  v_closer := pick_idle_closer(v_org);
  if v_closer is null then return null; end if;
  update incoming_leads
     set assigned_to = v_closer, assigned_at = now(),
         assignment_source = coalesce(assignment_source,'auto_idle')
   where id = p_lead and assigned_to is null;
  return v_closer;
end $function$
;

CREATE OR REPLACE FUNCTION public.assign_unit(p_incident_id uuid, p_unit_id uuid, p_by_kind text, p_by_user uuid, p_weight numeric, p_reasoning jsonb)
 RETURNS incident_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id    uuid;
  v_assignment public.incident_assignments;
BEGIN
  SELECT org_id INTO v_org_id FROM public.incidents WHERE id = p_incident_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'incident not found'; END IF;
  IF NOT (public.is_org_dispatcher(v_org_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.incident_assignments (
    org_id, incident_id, unit_id, assigned_by_kind, assigned_by,
    override_weight, reasoning_json, status
  )
  VALUES (
    v_org_id, p_incident_id, p_unit_id, p_by_kind, p_by_user,
    p_weight, COALESCE(p_reasoning, '{}'::jsonb), 'pending'
  )
  RETURNING * INTO v_assignment;

  UPDATE public.units
     SET status = 'assigned', active_assignment_id = v_assignment.id
   WHERE id = p_unit_id;

  UPDATE public.incidents
     SET status = 'assigned'
   WHERE id = p_incident_id;

  RETURN v_assignment;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_va_to_operator(p_operator uuid, p_va_profile uuid, p_role text DEFAULT 'support'::text)
 RETURNS operator_va_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.operator_va_assignments;
begin
  insert into public.operator_va_assignments(operator_id, va_profile_id, role)
  values (p_operator, p_va_profile, p_role)
  on conflict (operator_id, va_profile_id) do update set active = true, role = excluded.role
  returning * into v_row;
  return v_row;
end $function$
;

CREATE OR REPLACE FUNCTION public.assign_work(p_case_id uuid, p_candidate_id uuid, p_by_kind text DEFAULT 'system'::text, p_by_user uuid DEFAULT NULL::uuid, p_score numeric DEFAULT NULL::numeric, p_reasoning jsonb DEFAULT '{}'::jsonb)
 RETURNS work_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.work_assignments;
BEGIN
  INSERT INTO public.work_assignments
    (case_id, candidate_id, assigned_by_kind, assigned_by, score, reasoning, status)
  VALUES
    (p_case_id, p_candidate_id, p_by_kind, p_by_user, p_score, coalesce(p_reasoning, '{}'::jsonb), 'assigned')
  RETURNING * INTO v_row;

  UPDATE public.routing_candidates
    SET current_load = current_load + 1,
        status = CASE WHEN current_load + 1 >= max_concurrent THEN 'busy' ELSE status END,
        updated_at = now()
  WHERE id = p_candidate_id;

  UPDATE public.cases
    SET routing_status = 'assigned', assigned_at = now(), updated_at = now()
  WHERE id = p_case_id;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_route_intake()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform public.route_intake_event(new.id);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.backend_unlocked_for(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN (SELECT role FROM public.profiles WHERE id = p_user) = 'admin' THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.installations i
      JOIN public.profiles p ON p.organization_id = i.org_id
      WHERE p.id = p_user
        AND i.status = 'active'
        AND i.paid_at IS NOT NULL
        AND i.setup_completed_at IS NOT NULL
        AND i.comprehension_passed_at IS NOT NULL
    )
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_lead_intake(p_limit integer DEFAULT 2000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.bg_check_decide(p_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid  uuid := auth.uid();
  v_prev text;
begin
  if v_uid is not null and not (public.is_staff() or public.is_platform_admin()) then
    raise exception 'bg_check_decide: staff or admin only' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in
     ('Eligible','Not Eligible','Need Manager''s Review','out of radius','Not found') then
    raise exception 'bg_check_decide: decision must be one of Eligible | Not Eligible | Need Manager''s Review | out of radius | Not found';
  end if;

  if length(coalesce(p_notes,'')) > 4000 then
    raise exception 'bg_check_decide: notes too long';
  end if;

  select eligibility_status into v_prev from public.background_checks where id = p_id;
  if not found then
    raise exception 'bg_check_decide: background check % not found', p_id;
  end if;

  update public.background_checks
     set eligibility_status = p_decision,
         review_notes       = coalesce(nullif(btrim(coalesce(p_notes,'')),''), review_notes),
         date_verified      = current_date,
         reviewed_by        = v_uid,
         reviewed_at        = now(),
         updated_at         = now()
   where id = p_id;

  return jsonb_build_object(
    'id', p_id, 'from', v_prev, 'to', p_decision, 'reviewed_at', now()
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bg_check_queue(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, customer_name text, email_masked text, phone_last4 text, created_at timestamp with time zone, verification_form_submitted boolean, has_license boolean, has_insurance_proof boolean, has_paystub boolean, has_screenshot boolean, key_details text, eligibility_status text, review_notes text, date_verified date, reviewed_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    b.id,
    b.customer_name,
    case when nullif(btrim(coalesce(b.email,'')),'') is null then null
         else left(b.email,1)||'***'||substring(b.email from position('@' in b.email)) end,
    right(regexp_replace(coalesce(b.phone_number,''), '\D', '', 'g'), 4),
    b.created_at,
    coalesce(b.verification_form_submitted, b.verificaton_form_submitted),
    b.driver_s_license            is not null or b.drivers_license_front_path is not null,
    b.proof_of_insurance          is not null,
    b.paystub                     is not null,
    b.background_check_screenshot is not null,
    b.key_details_extracted_from_screenshot,
    b.eligibility_status,
    b.review_notes,
    b.date_verified,
    b.reviewed_at
  from public.background_checks b
  where (public.is_staff() or public.is_platform_admin())
    and (p_status is null or b.eligibility_status is not distinct from p_status)
  order by b.created_at desc
  limit greatest(1, least(coalesce(p_limit,100), 500));
$function$
;

CREATE OR REPLACE FUNCTION public.bills_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bind_install(p_org uuid, p_token text, p_hardware_uuid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.organization_licenses;
begin
  select * into v from public.organization_licenses where organization_id = p_org;
  if v.organization_id is null then return jsonb_build_object('allowed',false,'reason','no_license'); end if;
  if not coalesce(v.active,false) then return jsonb_build_object('allowed',false,'reason','inactive'); end if;
  if v.install_token_hash is null or v.install_token_hash <> encode(sha256(p_token::bytea),'hex')
    then return jsonb_build_object('allowed',false,'reason','bad_token'); end if;
  if coalesce(v.install_token_used,false) and v.hardware_uuid is distinct from p_hardware_uuid
    then return jsonb_build_object('allowed',false,'reason','token_already_used'); end if;
  update public.organization_licenses
     set hardware_uuid = p_hardware_uuid, install_token_used = true,
         last_heartbeat_at = now(), updated_at = now()
   where organization_id = p_org;
  return jsonb_build_object('allowed',true,'bound_to',p_hardware_uuid);
end $function$
;

CREATE OR REPLACE FUNCTION public.book_operator_commission(p_operator uuid, p_gross_cents integer, p_period_start date, p_period_end date, p_recurring_pct smallint DEFAULT NULL::smallint)
 RETURNS revenue_splits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_pct smallint; v_op_cents int; v_row public.revenue_splits;
begin
  select coalesce(p_recurring_pct, revenue_share_pct, 20) into v_pct from public.operator_profiles where id = p_operator;
  v_op_cents := (p_gross_cents * v_pct) / 100;
  insert into public.revenue_splits(operator_id, period_start, period_end, gross_cents, platform_cents, operator_cents, status, metadata)
  values (p_operator, p_period_start, p_period_end, p_gross_cents, p_gross_cents - v_op_cents, v_op_cents, 'pending',
          jsonb_build_object('kind','operator_recurring','pct',v_pct))
  returning * into v_row;
  return v_row;
end $function$
;

CREATE OR REPLACE FUNCTION public.capture_form_intake()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform public.intake_capture(
    'customer_intake_forms', new.id::text,
    concat_ws(' ', new.request_type, new.subject, new.details, new.source),
    to_jsonb(new), null
  );
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.capture_handoff_consent(p_referral_id uuid, p_consent_channel text)
 RETURNS partner_referrals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.partner_referrals;
begin
  if coalesce(btrim(p_consent_channel), '') = '' then
    raise exception 'p_consent_channel required: sms | email | call | form | in_person';
  end if;

  -- Authorization guard.
  if auth.role() is distinct from 'service_role'
     and auth.role() is not null
     and not public.is_staff()
     and auth.uid() is distinct from
         (select source_operator_id from public.partner_referrals where id = p_referral_id) then
    raise exception 'capture_handoff_consent: only the sourcing operator or staff may record consent'
      using errcode = '42501';
  end if;

  update public.partner_referrals
     set consent_captured_at = coalesce(consent_captured_at, now()),
         consent_channel     = p_consent_channel
   where id = p_referral_id
  returning * into v_row;

  if v_row.id is null then raise exception 'referral % not found', p_referral_id; end if;
  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.capture_lead_intake()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform public.intake_capture(
    'incoming_leads', new.id::text,
    concat_ws(' ', new.opportunity_name, new.notes, new.sku, new.source_campaign,
                   new.utm_campaign, new.utm_source, new.lane),
    to_jsonb(new), new.org_id
  );
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.certify_operator(p_profile_id uuid, p_track text, p_total_score smallint, p_scored_by uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_op_id uuid;
begin
  if not public.operator_academy_complete(p_profile_id, p_track) then
    return false;                       -- modules not finished: cannot certify
  end if;
  select id into v_op_id from public.operator_profiles where profile_id = p_profile_id limit 1;
  if v_op_id is null then
    return false;                       -- no operator profile to promote
  end if;
  insert into public.operator_rubric_scores (operator_id, period_month, total_score, scored_by, notes)
    values (v_op_id, date_trunc('month', now())::date, p_total_score, p_scored_by, 'capstone certification');
  update public.operator_profiles
    set level = 'certified', rubric_score = p_total_score, certified_at = now(), updated_at = now()
    where id = v_op_id and level = 'candidate';
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_agent_job(p_worker text)
 RETURNS agent_jobs
 LANGUAGE plpgsql
AS $function$
declare
  j public.agent_jobs;
begin
  update public.agent_jobs a
     set status     = 'running',
         claimed_by = p_worker,
         claimed_at = now(),
         attempts   = a.attempts + 1
   where a.id = (
     select id from public.agent_jobs
      where status = 'queued'
      order by created_at
      limit 1
      for update skip locked
   )
  returning a.* into j;
  return j;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_open_referral(p_referral_id uuid, p_operator uuid)
 RETURNS partner_referrals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.partner_referrals;
begin
  -- Authorization guard.
  if auth.role() is distinct from 'service_role'
     and auth.role() is not null
     and auth.uid() is distinct from p_operator
     and not public.is_staff() then
    raise exception 'claim_open_referral: you may only claim a referral for yourself'
      using errcode = '42501';
  end if;

  update public.partner_referrals
     set affiliate_user_id = p_operator, status = 'accepted', accepted_at = now()
   where id = p_referral_id
     and status = 'pending' and affiliate_user_id is null and consent_captured_at is not null
  returning * into v_row;
  if v_row.id is null then
    raise exception 'referral % not claimable (already taken, no consent, or not pending)', p_referral_id;
  end if;
  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.classify_program(p_text text)
 RETURNS TABLE(program text, matched_on text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.slug, kw
  from public.programs p
  cross join lateral unnest(p.match_keywords) kw
  where p.active
    and coalesce(p_text, '') <> ''
    and lower(p_text) like '%' || lower(kw) || '%'
  order by p.priority, length(kw) desc
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_good_standing(p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare v_email text := lower(trim(p_email)); v_ok boolean := false; begin if v_email is null or v_email = '' then return false; end if; select exists (select 1 from public.bookings b where lower(b.customer_email) = v_email and b.status in ('confirmed', 'active')) into v_ok; if not v_ok then return false; end if; if exists (select 1 from public.rental_ledger rl where lower(rl.customer_email) = v_email and rl.entry_type = 'payment' and rl.status not in ('completed', 'cancelled') and rl.due_at is not null and rl.due_at < now()) then return false; end if; if exists (select 1 from public.client_renter_status crs where lower(crs.customer_email) = v_email and crs.canonical_stage in ('escalation', 'closed_lost')) then return false; end if; if exists (select 1 from public.cases c where lower(c.customer_email) = v_email and c.status = 'blocked') then return false; end if; return true; end; $function$
;

CREATE OR REPLACE FUNCTION public.compute_lto_eligible(p_profile_id uuid, p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare v_journey public.client_journey%rowtype; begin select * into v_journey from public.client_journey where lower(customer_email) = lower(trim(p_email)) limit 1; if v_journey.id is null then return false; end if; if not public.credit_base_path_satisfied(v_journey.id) then return false; end if; if p_profile_id is null or not public.credit_education_complete(p_profile_id) then return false; end if; if p_profile_id is null or not public.training_core_complete(p_profile_id) then return false; end if; if not exists (select 1 from public.journey_checkpoint_events e where e.journey_id = v_journey.id and e.checkpoint_slug = 'day_90_good_standing') then return false; end if; return true; end; $function$
;

CREATE OR REPLACE FUNCTION public.create_affiliate_link(p_operator uuid, p_recurring_pct smallint DEFAULT NULL::smallint, p_landing text DEFAULT '/'::text)
 RETURNS TABLE(code text, link text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text; v_pct smallint;
begin
  select coalesce(p_recurring_pct, revenue_share_pct, 20) into v_pct from public.operator_profiles where id = p_operator;
  if v_pct is null then raise exception 'operator % not found', p_operator; end if;
  v_code := lower(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.affiliate_links(operator_id, code, recurring_pct, landing_path) values (p_operator, v_code, v_pct, p_landing);
  return query select v_code, ('https://aixmos-offer.vercel.app'||p_landing||'?ref='||v_code);
end $function$
;

CREATE OR REPLACE FUNCTION public.credit_base_path_satisfied(p_journey_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists (select 1 from public.credit_billing_plans p where p.journey_id = p_journey_id and p.is_add_on = false and p.status = 'active' and p.credit_path = 'monthly_97' and (p.next_billing_at is null or p.next_billing_at >= now() - interval '45 days')) or exists (select 1 from public.credit_billing_plans p where p.journey_id = p_journey_id and p.is_add_on = false and p.credit_path = 'payment_plan_500' and p.status = 'completed' and p.paid_at is not null); $function$
;

CREATE OR REPLACE FUNCTION public.credit_education_complete(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select not exists (select 1 from public.credit_education_sections s where s.required = true and s.active = true and not exists (select 1 from public.credit_education_acknowledgments a where a.profile_id = p_profile_id and a.section_id = s.id)); $function$
;

CREATE OR REPLACE FUNCTION public.current_organization_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select organization_id from public.profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.current_profile_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select email from public.profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select role from public.profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.dispute_clients_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_handoff_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  -- Cannot advance a referral to a served/billable state without captured consent.
  if NEW.status in ('accepted','completed','paid') and NEW.consent_captured_at is null then
    raise exception
      'Federation handoff to % blocked: client consent not captured (status=%).', NEW.dest_org, NEW.status
      using errcode = 'check_violation',
            hint = 'Set consent_captured_at + consent_channel when the client agrees to the cross-entity handoff.';
  end if;

  -- If consent is captured, the channel it was captured on must be recorded (audit trail).
  if NEW.consent_captured_at is not null and (NEW.consent_channel is null or btrim(NEW.consent_channel) = '') then
    raise exception
      'Consent captured for handoff to % but consent_channel is empty.', NEW.dest_org
      using errcode = 'check_violation',
            hint = 'Record how consent was obtained: sms | email | call | form | in_person.';
  end if;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_operator_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_seats int;
begin
  if coalesce((new.metadata->>'seat_paid')::boolean, false) then
    select count(*) into v_seats from operator_profiles where (metadata->>'seat_paid')::boolean is true;
    if v_seats >= 100 then
      raise exception 'TMMT OPERATOR CAP REACHED: 100 paid seats forever. Owner must retire a seat first.';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.eval_money_rails(p_token text)
 RETURNS TABLE(id text, status text, what text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  expected_hash CONSTANT text := 'bdaa81728fd08272e86f4a5d41d21a64f879b41899d98ef6f57373bb202c461f';
BEGIN
  IF p_token IS NULL
     OR encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected_hash THEN
    RAISE EXCEPTION 'eval_money_rails: bad token';
  END IF;

  RETURN QUERY
  WITH pq AS MATERIALIZED (
    -- the ONE scan. everything lead-shaped is derived from here.
    SELECT l.is_dnc, l.is_dnr, l.callable, l.phone10
    FROM public.v_prequalified_leads l
  ),
  agg AS (
    SELECT
      count(*) FILTER (WHERE is_dnc AND callable)                                   AS dnc_callable,
      count(*) FILTER (WHERE is_dnr AND callable)                                   AS dnr_callable,
      count(*) FILTER (WHERE callable AND (phone10 IS NULL OR length(phone10) <> 10)) AS bad_phone
    FROM pq
  )
  SELECT 'dnc-list-readable'::text,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_policies p
           WHERE p.schemaname='public' AND p.tablename='do_not_contact_numbers'
             AND p.cmd='SELECT' AND 'authenticated' = ANY(p.roles)
         ) THEN 'PASS' ELSE 'FAIL' END::text,
         'DNC must be SELECT-able by authenticated or gates fail OPEN'::text
  UNION ALL
  SELECT 'no-dnc-is-callable',
         CASE WHEN a.dnc_callable=0 THEN 'PASS' ELSE 'FAIL' END,
         'opted-out marked callable: '||a.dnc_callable::text
  FROM agg a
  UNION ALL
  SELECT 'no-dnr-is-callable',
         CASE WHEN a.dnr_callable=0 THEN 'PASS' ELSE 'FAIL' END,
         'blacklisted marked callable: '||a.dnr_callable::text
  FROM agg a
  UNION ALL
  SELECT 'compliance-views-are-invoker',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         'compliance views running as DEFINER: '||count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='v' AND n.nspname='public'
    AND c.relname IN ('v_prequalified_leads','v_collections_truth')
    AND COALESCE((SELECT option_value FROM pg_options_to_table(c.reloptions)
                  WHERE option_name='security_invoker'),'off') <> 'on'
  UNION ALL
  SELECT 'callable-has-real-phone',
         CASE WHEN a.bad_phone=0 THEN 'PASS' ELSE 'FAIL' END,
         'callable leads with bad phone: '||a.bad_phone::text
  FROM agg a
  UNION ALL
  SELECT 'anon-cannot-read-leads',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         'anon SELECT grants on lead tables: '||count(*)::text
  FROM information_schema.role_table_grants
  WHERE grantee='anon' AND privilege_type='SELECT' AND table_schema='public'
    AND table_name IN ('do_not_contact_numbers','incoming_leads','background_checks')
  UNION ALL
  SELECT 'verified-col-still-the-typo-one',
         CASE WHEN (SELECT count(*) FROM public.background_checks WHERE verificaton_form_submitted IS TRUE)
                >= (SELECT count(*) FROM public.background_checks WHERE verification_form_submitted IS TRUE)
              THEN 'PASS' ELSE 'FAIL' END,
         'if FAIL: data moved to correctly-spelled col â€” update v_prequalified_leads'
  UNION ALL
  SELECT 'anon-cannot-truncate-leadbook',
         CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
         'anon TRUNCATE/DELETE grants: '||count(*)::text
  FROM information_schema.role_table_grants
  WHERE grantee='anon' AND privilege_type IN ('TRUNCATE','DELETE') AND table_schema='public'
    AND table_name IN ('incoming_leads','background_checks')
  UNION ALL
  SELECT 'canary-sql-alarm-fires', 'FAIL',
         'canary: designed to FAIL. If this reads PASS, the SQL guard is lying.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.expense_fill_from_vehicle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f record;
begin
  if coalesce(new.vehicle, new.vehicle_name, '') = '' then return new; end if;

  select partner_name, customer into f
  from public.fleet
  where vehicle_name = coalesce(new.vehicle, new.vehicle_name)
     or id::text     = new.vehicle
  limit 1;

  if found then
    new.partner_name := coalesce(f.partner_name, new.partner_name);
    new.customer     := coalesce(f.customer,     new.customer);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.fail_agent_job(p_id bigint, p_error text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  j public.agent_jobs;
  max_a int;
begin
  select * into j from public.agent_jobs where id = p_id;
  if not found then return; end if;
  select coalesce(max_attempts, 3) into max_a
    from public.agent_definitions where slug = j.agent_slug;
  if j.attempts >= coalesce(max_a, 3) then
    update public.agent_jobs
       set status = 'failed', error = p_error, finished_at = now() where id = p_id;
  else
    update public.agent_jobs
       set status = 'queued', error = p_error, claimed_by = null, claimed_at = null
     where id = p_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.find_best_unit(p_incident_id uuid)
 RETURNS TABLE(unit_id uuid, callsign text, distance_km numeric, capability_match_score smallint, eta_seconds integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid;
  v_lat double precision;
  v_lng double precision;
  v_caps text[];
  v_class text;
BEGIN
  SELECT i.org_id, i.location_lat, i.location_lng, i.required_capabilities, i.required_class
    INTO v_org_id, v_lat, v_lng, v_caps, v_class
  FROM public.incidents i
  WHERE i.id = p_incident_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'incident not found';
  END IF;

  IF NOT (public.is_org_member(v_org_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.callsign,
    ROUND(
      (6371 * 2 * asin(sqrt(
        sin(radians((u.current_lat - v_lat) / 2)) ^ 2
        + cos(radians(v_lat)) * cos(radians(u.current_lat))
          * sin(radians((u.current_lng - v_lng) / 2)) ^ 2
      )))::numeric, 2)                                                AS distance_km,
    COALESCE(cardinality(
      ARRAY(SELECT unnest(v_caps) INTERSECT SELECT unnest(f.capability_tags))
    ), 0)::smallint                                                   AS capability_match_score,
    GREATEST(
      30,
      (ROUND(
        (6371 * 2 * asin(sqrt(
          sin(radians((u.current_lat - v_lat) / 2)) ^ 2
          + cos(radians(v_lat)) * cos(radians(u.current_lat))
            * sin(radians((u.current_lng - v_lng) / 2)) ^ 2
        ))) / 56 * 3600)::integer
      )
    )                                                                 AS eta_seconds
  FROM public.units u
  LEFT JOIN public.fleet f ON f.id = u.fleet_id
  WHERE u.org_id = v_org_id
    AND u.status = 'available'
    AND u.current_lat IS NOT NULL AND u.current_lng IS NOT NULL
    AND (v_class IS NULL OR f.vehicle_class = v_class)
    AND (coalesce(cardinality(v_caps),0) = 0
         OR (f.capability_tags IS NOT NULL AND f.capability_tags @> v_caps))
  ORDER BY capability_match_score DESC, distance_km ASC
  LIMIT 5;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finish_agent_job(p_id bigint, p_response text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  j public.agent_jobs;
  d public.agent_definitions;
  v_ans text;
begin
  select * into j from public.agent_jobs where id = p_id;
  if not found then raise exception 'agent_jobs % not found', p_id; end if;

  select * into d from public.agent_definitions where slug = j.agent_slug;

  update public.agent_jobs
     set status = 'done', response = p_response, error = null, finished_at = now()
   where id = p_id;

  -- Only write back when the definition says where to, and only if still null.
  if d.target_field is not null and d.source_table is not null then
    v_ans := btrim(p_response);
    execute format(
      'update public.%I set %I = $1 where id::text = $2 and %I is null',
      d.source_table, d.target_field, d.target_field
    ) using v_ans, j.record_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_moe_taha_cut_cents(gross_cents integer, tier text DEFAULT 'best'::text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (gross_cents * case lower(tier)
            when 'best'  then 50
            when 'mid'   then 40
            when 'worst' then 30
            else 50 end) / 100;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_round_robin_assign(p_assignees uuid[], p_lanes text[] DEFAULT ARRAY['LANE_DIRECT'::text, 'LANE_REENGAGE'::text], p_max_each integer DEFAULT 25, p_dry_run boolean DEFAULT true)
 RETURNS TABLE(operator_id uuid, lead_id uuid, contact_name text, lane text, applied boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n int := coalesce(array_length(p_assignees, 1), 0);
  v_allowed constant text[] := array['LANE_DIRECT','LANE_REENGAGE','LANE_REPERMISSION'];
  v_lanes text[];
  v_rejected text[];
begin
  if v_n = 0 then
    raise exception 'fn_round_robin_assign: no assignees given â€” refusing to assign';
  end if;

  select array_agg(x) into v_rejected from unnest(p_lanes) x where x <> all(v_allowed);
  if v_rejected is not null then
    raise warning 'fn_round_robin_assign: refusing non-contactable lane(s): %', v_rejected;
  end if;

  select array_agg(x) into v_lanes from unnest(p_lanes) x where x = any(v_allowed);
  if v_lanes is null then
    raise exception 'fn_round_robin_assign: no contactable lane requested â€” refusing to assign';
  end if;

  return query
  with pool as (
    select b.lead_id, b.contact_name, b.contact_gate as lane,
           row_number() over (
             order by array_position(v_lanes, b.contact_gate), b.age_days nulls last, b.lead_id
           ) - 1 as rn
    from v_outreach_book b
    where b.contact_gate = any(v_lanes)
      and b.assigned_to is null
      -- belt AND suspenders: never trust the view alone for the money conditions
      and not b.is_dnc
      and not b.is_jv
      and length(b.phone10) = 10
  ),
  picked as (
    select v_lanes, p_assignees[(pool.rn % v_n) + 1] as op, pool.lead_id, pool.contact_name, pool.lane,
           row_number() over (partition by (pool.rn % v_n) order by pool.rn) as per_op
    from pool
  ),
  capped as (
    select * from picked where per_op <= p_max_each
  ),
  applied_rows as (
    update incoming_leads il
       set assigned_to = c.op,
           assigned_at = now(),
           assignment_source = 'round-robin'
      from capped c
     where il.id = c.lead_id
       and not p_dry_run
       and il.assigned_to is null
    returning il.id
  )
  select c.op, c.lead_id, c.contact_name, c.lane,
         (not p_dry_run) and exists (select 1 from applied_rows a where a.id = c.lead_id)
  from capped c
  order by c.op, c.per_op;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_daily_brief(p_org uuid DEFAULT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_rented int; v_available int; v_maint int; v_retired int;
  v_leads_total int; v_leads_30d int; v_new_leads int;
  v_pay int; v_ticket int; v_reeng int; v_wait int; v_bg int; v_pending int;
begin
  select count(*) filter (where vehicle_status='Rented'),
         count(*) filter (where vehicle_status='Available'),
         count(*) filter (where vehicle_status='Under Maintenance'),
         count(*) filter (where vehicle_status='Retired')
    into v_rented, v_available, v_maint, v_retired from fleet;

  select count(*), count(*) filter (where created_at > now()-interval '30 days'),
         count(*) filter (where status='New Lead')
    into v_leads_total, v_leads_30d, v_new_leads from incoming_leads;

  select count(*) filter (where category='payment_followup'),
         count(*) filter (where category='ticket_collect'),
         count(*) filter (where category='lead_reengagement'),
         count(*) filter (where category='waitlist_contact'),
         count(*) filter (where category='bgcheck_review'),
         count(*)
    into v_pay, v_ticket, v_reeng, v_wait, v_bg, v_pending
    from exec_va_tasks where status='pending';

  delete from coo_briefings where briefing_date=current_date and kind='daily' and org_id=p_org;

  insert into coo_briefings(briefing_date, kind, org_id, submitted_by,
    pipeline_health, escalations, blockers, director_sync, weekly_summary)
  values(current_date,'daily',p_org,null,
    format('FLEET: %s rented / %s available (idle) / %s maintenance / %s retired. LEADS: %s total, %s created in 30d, %s in New Lead. Pending VA tasks: %s.',
      v_rented,v_available,v_maint,v_retired,v_leads_total,v_leads_30d,v_new_leads,v_pending),
    format('MONEY-FIRST: %s payment_followup + %s ticket_collect = %s dollar-recovery tasks queued. Owner-gated: draft + one-tap send.',
      v_pay,v_ticket,coalesce(v_pay,0)+coalesce(v_ticket,0)),
    format('THROUGHPUT GATE: %s bgcheck_review blocking new rentals. PIPELINE WAITING: %s lead_reengagement + %s waitlist_contact.',
      v_bg,v_reeng,v_wait),
    'GATED: CHUMMO/VISION outbound stays OFF until owner approves each send. Self-generated by generate_daily_brief() on the pg_cron heartbeat.',
    format('Auto-brief %s. %s idle cars = fastest revenue - match against %s re-engagement + %s waitlist contacts.',
      current_date, v_available, v_reeng, v_wait))
  returning id into v_id;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.generate_va_tasks()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count int := 0;
  v_today date := current_date;
BEGIN
  -- Idempotent: skip if already generated today
  IF EXISTS (SELECT 1 FROM exec_va_tasks WHERE sweep_date = v_today LIMIT 1) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already ran today');
  END IF;

  -- 1. URGENT: Overdue payments (active customers still renting)
  INSERT INTO exec_va_tasks (category, priority, agent, subject_name, subject_phone, context)
  SELECT
    'payment_followup', 'urgent', 'CHUMMO',
    cp.customer,
    cp.customer_phone_number::text,
    jsonb_build_object(
      'amount', cp.amount,
      'past_due', cp.amout_past_due,
      'last_payment', cp.last_payment_date,
      'next_due', cp.next_payment_due_date,
      'payment_status', cp.payment_status,
      'notes', cp.notes
    )
  FROM customer_payments cp
  WHERE cp.payment_status ILIKE '%overdue%'
     OR cp.payment_status ILIKE '%past due%'
     OR cp.payment_status ILIKE '%late%'
     OR (cp.next_payment_due_date IS NOT NULL AND cp.next_payment_due_date < current_date);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 2. HIGH: Waitlist contacts waiting 30+ days with no resolution
  INSERT INTO exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context)
  SELECT
    'waitlist_contact', 'high', 'CHUMMO',
    w.customer_name,
    w.customer_phone::text,
    w.customer_email::text,
    jsonb_build_object(
      'days_waiting', (current_date - w.date_added_to_waitlist),
      'vehicle_type', w.vehicle_type,
      'make', w.make,
      'model', w.model,
      'desired_weekly', w.desired_weekly_payment,
      'status', w.status
    )
  FROM waitlist w
  WHERE w.status NOT IN ('Fulfilled','Cancelled','Converted','Not Interested','Removed')
    AND w.date_added_to_waitlist IS NOT NULL
    AND w.date_added_to_waitlist < current_date - 30;

  -- 3. HIGH: Background checks needing manager review
  INSERT INTO exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context)
  SELECT
    'bgcheck_review', 'high', 'VISION',
    bc.customer_name,
    bc.phone_number::text,
    bc.email::text,
    jsonb_build_object(
      'eligibility_status', bc.eligibility_status,
      'customer_id', bc.customer_id,
      'review_notes', bc.review_notes
    )
  FROM background_checks bc
  WHERE bc.eligibility_status = 'Need Manager''s Review'
     OR bc.eligibility_status IS NULL;

  -- 4. MEDIUM: Stale leads (null/New status, 30+ days old)
  INSERT INTO exec_va_tasks (category, priority, agent, subject_name, subject_phone, subject_email, context)
  SELECT
    'lead_reengagement', 'medium', 'CHUMMO',
    l.contact_name,
    COALESCE(l.phone_e164, l.phone::text),
    l.email,
    jsonb_build_object(
      'created_on', l.created_at,
      'days_old', (current_date - l.created_at::date),
      'opportunity', l.opportunity_name
    )
  FROM incoming_leads l
  WHERE (l.status IS NULL OR l.status IN ('New', 'New Lead'))
    AND l.created_at < now() - interval '30 days'
    AND (l.phone IS NOT NULL OR l.phone_e164 IS NOT NULL)
    AND l.email NOT ILIKE '%noreply%'
  LIMIT 100;

  -- 5. MEDIUM: Ticket collection (customers with $50+ outstanding)
  INSERT INTO exec_va_tasks (category, priority, agent, subject_name, subject_phone, context)
  SELECT
    'ticket_collect', 'medium', 'CHUMMO',
    t.requested_by_customer,
    NULL,
    jsonb_build_object(
      'ticket_ids', array_agg(t.ticket_id),
      'total_owed', sum(t.amount),
      'violation_types', array_agg(DISTINCT t.violation_type)
    )
  FROM tickets t
  WHERE t.amount > 0
    AND (t.status IS NULL OR t.status NOT IN ('Closed','Resolved','Done'))
    AND t.requested_by_customer IS NOT NULL
  GROUP BY t.requested_by_customer
  HAVING sum(t.amount) >= 50;

  RETURN jsonb_build_object(
    'ok', true,
    'sweep_date', v_today,
    'tasks_created', (SELECT count(*) FROM exec_va_tasks WHERE sweep_date = v_today)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_partner_fleet()
 RETURNS TABLE(fleet_id uuid, vehicle_name text, vehicle_make text, vehicle_model text, year integer, vehicle_status text, color text, partner_percentage numeric, partner_portal_notes text, last_updated_at timestamp with time zone, license_plate text, vin_number text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    f.id,
    f.vehicle_name,
    f.vehicle_make,
    f.vehicle_model,
    f.year,
    f.vehicle_status,
    f.color,
    f.partner_percentage,
    f.partner_portal_notes,
    coalesce(f.updated_at, f.created_at),
    f.license_plate,
    f.vin AS vin_number
  FROM public.fleet f
  INNER JOIN public.partner_fleet_access pfa
    ON pfa.fleet_id = f.id
   AND pfa.partner_user_id = auth.uid ()
  WHERE public.is_partner ();
$function$
;

CREATE OR REPLACE FUNCTION public.ghl_appointments_set_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  new.synced_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ghl_contacts_set_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  new.synced_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ghl_intake_lead(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
  v_utm_source  text := nullif(btrim(coalesce(
                   p #>> '{body,contact,lastAttributionSource,utmSource}',
                   p #>> '{body,attributionSource,utmSource}', '')), '');
  v_utm_medium  text := nullif(btrim(coalesce(
                   p #>> '{body,contact,lastAttributionSource,utmMedium}',
                   p #>> '{body,attributionSource,medium}', '')), '');
  v_session_src text := nullif(btrim(coalesce(
                   p #>> '{body,attributionSource,sessionSource}',
                   p #>> '{body,contact,attributionSource,sessionSource}', '')), '');
  v_referrer    text := nullif(btrim(coalesce(
                   p #>> '{body,contact,lastAttributionSource,referrer}',
                   p #>> '{body,contact,lastAttributionSource,url}', '')), '');
  v_source      text;
begin
  -- Same precedence the public lead form already uses: utm first, then referrer.
  v_source := lower(coalesce(
    v_utm_source,
    v_session_src,
    case
      when v_referrer ilike '%tiktok%'    then 'tiktok'
      when v_referrer ilike '%instagram%' then 'ig'
      when v_referrer ilike '%snapchat%'  then 'snap'
      when v_referrer ilike '%facebook%' or v_referrer ilike '%fb.com%' then 'meta'
      when v_referrer ilike '%youtube%'   then 'youtube'
      when v_referrer ilike '%google%' or v_referrer ilike '%bing%' or v_referrer ilike '%duckduckgo%' then 'organic'
      when v_referrer is not null         then 'referral'
      else null
    end,
    'ghl'
  ));

  insert into public.incoming_leads
    (contact_name, opportunity_name, phone_text, email, created_on, status,
     source, source_medium, utm_source, utm_medium, referrer_url, source_confidence)
  values (
    p #>> '{body,full_name}',
    p #>> '{body,pipeline_name}',
    p #>> '{body,phone}',
    p #>> '{body,email}',
    coalesce((p #>> '{body,date_created}')::timestamptz, now()),
    'New Lead',
    v_source, v_utm_medium, v_utm_source, v_utm_medium, v_referrer, 'captured'
  )
  returning id into v_id;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.ghl_intake_verification_form(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into public.background_checks
    (customer_name, email, phone_number, driver_s_license, own_insurance,
     proof_of_insurance, paystub, verification_form_submitted)
  values (
    p #>> '{body,full_name}',
    p #>> '{body,email}',
    p #>> '{body,phone}',
    to_jsonb(p #> '{body,Upload a copy of your driver''s license}'),
    p #>> '{body,Do you have your own insurance? }',
    to_jsonb(p #> '{body,If yes\, please upload your insurance document}'),
    to_jsonb(p #> '{body,Upload proof of your Uber/Lyft or DoorDash/UberEats account}'),
    true
  )
  returning id into v_id;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardian_scan()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object(
  'scanned_at', now(),
  'admins', (select count(*) from profiles where role::text='admin' or portal_role::text in ('admin','super_admin')),
  'super_admins', (select count(*) from profiles where portal_role::text='super_admin'),
  'auth_users', (select count(*) from auth.users),
  'users_last_24h', (select count(*) from auth.users where created_at > now()-interval '24 hours'),
  'org_role_grants_last_24h', (select count(*) from org_roles where created_at > now()-interval '24 hours'),
  'licenses_disabled', (select count(*) from organization_licenses where active=false),
  'licenses_kill_set', (select count(*) from organization_licenses where kill_command is not null),
  'leaky_true_policies', (select count(*) from pg_policies where schemaname='public' and qual='true' and cmd in ('SELECT','ALL') and 'authenticated'=any(roles)),
  'audit_events_total', (select count(*) from audit_events)
 );
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.intake_capture(p_source text, p_record_id text, p_haystack text, p_payload jsonb DEFAULT NULL::jsonb, p_org uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id bigint; v_prog text; v_kw text; v_conf text;
  v_signal text := public.intake_signal(p_haystack);
begin
  select program, matched_on into v_prog, v_kw from public.classify_program(p_haystack);

  if v_prog is not null then
    v_conf := 'rule';
  elsif v_signal is null or length(v_signal) < 12 or v_signal !~ '[A-Za-z]{3,}\s+[A-Za-z]{3,}' then
    -- Nothing to reason about. Do not spend a model call inventing an answer.
    v_prog := 'general';
    v_conf := 'rule';
    v_kw   := 'no-signal';
  else
    v_conf := 'unresolved';
  end if;

  insert into public.intake_events
    (source, record_id, haystack, payload, program, confidence, matched_on, org_id, note)
  values (
    p_source, p_record_id, left(coalesce(p_haystack, ''), 4000), p_payload,
    v_prog, v_conf, v_kw, p_org,
    case when v_kw = 'no-signal' then 'filed as general: record carries no usable detail' end
  )
  returning id into v_id;

  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.intake_signal(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select nullif(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_text, ''),
          'Auto-promoted from GHL contact\s+[A-Za-z0-9]+(\s+on\s+[0-9-]+)?', ' ', 'gi'),
        'Backfill from GHL contact\s+[A-Za-z0-9]+', ' ', 'gi'),
      '\s+', ' ', 'g')
  ), '');
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select role = 'admin'
      or coalesce(portal_role::text, '') in ('admin', 'super_admin')
    from public.profiles where id = auth.uid()
  ), false)
$function$
;

CREATE OR REPLACE FUNCTION public.is_internal_ops()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if to_regclass('public.profiles') is null then
    return true;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('admin', 'internal_team', 'investor')
  );
exception when others then
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.portal_role = 'manager'::public.portal_role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_dispatcher(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.org_roles
    WHERE org_id  = p_org_id
      AND user_id = auth.uid()
      AND role IN ('tenant_admin','dispatcher')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
      select 1 from public.org_roles
      where org_id = p_org_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and organization_id = p_org_id
        and role::text in ('admin', 'internal_team')
    );
$function$
;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((
    SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid ()
  ), false) OR coalesce(public.app_auth_role () = 'admin', false);
$function$
;

CREATE OR REPLACE FUNCTION public.is_partner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')) = 'partner'::text;
$function$
;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select role in ('admin', 'internal_team')
      or coalesce(portal_role::text, '') in ('team_member', 'manager', 'admin', 'super_admin')
    from public.profiles where id = auth.uid()
  ), false)
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select portal_role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  )
$function$
;

CREATE OR REPLACE FUNCTION public.lead_to_active_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if coalesce(new.status, '') is distinct from 'Contracting' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'Contracting' then return new; end if;

  if exists (
    select 1 from public.active_customers a
    where (coalesce(a.contact_email, '') <> '' and lower(a.contact_email) = lower(coalesce(new.email, '')))
       or (coalesce(a.customer_name, '') <> '' and lower(a.customer_name) = lower(coalesce(new.contact_name, '')))
  ) then
    return new;
  end if;

  insert into public.active_customers
    (customer_name, contact_phone, contact_email, vehicle_rented, status, rental_start_date, org_id)
  values
    (new.contact_name, coalesce(new.phone_text, new.phone::text), new.email,
     new.fleet, 'Active', null, new.org_id);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.leadnet_daily_digest()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_enabled boolean; v_new integer; v_rental integer; v_detail integer;
        v_overdue integer; v_uncontacted integer;
begin
  select digest_enabled into v_enabled from leadnet_config where id;
  if not coalesce(v_enabled, true) then return; end if;

  select count(*),
         count(*) filter (where lane = 'rental'),
         count(*) filter (where lane = 'detail')
    into v_new, v_rental, v_detail
    from incoming_leads where created_at > now() - interval '24 hours';
  select count(*) into v_overdue from lead_followups where status = 'escalated' and escalated_at > now() - interval '24 hours';
  select count(*) into v_uncontacted from incoming_leads
    where created_at > now() - interval '7 days' and contacted_at is null and opted_out is not true;

  perform leadnet_post_slack(
    'â˜€ï¸ LEAD NET daily â€” new leads 24h: ' || v_new ||
    ' (rental ' || v_rental || ' Â· detail ' || v_detail || ' Â· unrouted ' || (v_new - v_rental - v_detail) || ')' ||
    E'\nâ€¢ escalations last 24h: ' || v_overdue ||
    E'\nâ€¢ last-7d leads still uncontacted: ' || v_uncontacted ||
    E'\nWork the list: GHL â†’ Conversations. Never text DND/STOP contacts.');
end $function$
;

CREATE OR REPLACE FUNCTION public.leadnet_post_slack(msg text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_url text;
begin
  select slack_webhook_url into v_url from leadnet_config where id;
  if v_url is null or v_url = '' then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('text', msg),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.leadnet_sla_sweep()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_enabled boolean; v_count integer; v_lines text;
begin
  select sweep_enabled into v_enabled from leadnet_config where id;
  if not coalesce(v_enabled, true) then return; end if;

  -- lead got a first touch -> clock satisfied
  update lead_followups f set status = 'done', resolved_at = now()
  from incoming_leads l
  where f.lead_id = l.id and f.status = 'open' and l.contacted_at is not null;

  -- overdue and untouched -> escalate once
  with esc as (
    update lead_followups f set status = 'escalated', escalated_at = now()
    from incoming_leads l
    where f.lead_id = l.id and f.status = 'open' and f.due_at < now()
    returning coalesce(l.contact_name,'(no name)') || ' Â· ' ||
              coalesce(l.phone_text, l.phone_e164, 'no phone') || ' Â· ' ||
              coalesce(l.lane,'?') || ' Â· ' || coalesce(l.source,'?') as line
  )
  select count(*), string_agg('â€¢ ' || line, E'\n') into v_count, v_lines from esc;

  if coalesce(v_count,0) > 0 then
    perform leadnet_post_slack(
      'ðŸš¨ LEAD NET â€” ' || v_count || ' lead(s) past the first-touch clock with NO contact:' ||
      E'\n' || v_lines || E'\nSomeone grab these now (GHL â†’ Conversations).');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.leadnet_start_clock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_sla integer;
begin
  select sla_minutes into v_sla from leadnet_config where id;
  insert into lead_followups (lead_id, organization_id, due_at, note)
  values (new.id, new.organization_id, now() + make_interval(mins => coalesce(v_sla, 60)),
          'auto: first-touch clock (' || coalesce(new.source,'unknown source') || ')');
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.leads_feed(p_secret text)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, contact_name text, email text, phone_text text, source text, status text, notes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select l.id, l.created_at, l.contact_name, l.email, l.phone_text,
         l.source, l.status, left(coalesce(l.notes, ''), 500)
  from public.incoming_leads l
  where encode(extensions.digest(coalesce(p_secret,''), 'sha256'), 'hex')
        = 'afb355fd06d873c8b138649d22ce2abf4297ad901772cdca4b0547658af024f5'
  order by l.created_at desc
  limit 50
$function$
;

CREATE OR REPLACE FUNCTION public.license_heartbeat(p_org uuid, p_hardware_uuid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.organization_licenses;
begin
  select * into v from public.organization_licenses where organization_id = p_org;
  if v.organization_id is null then return jsonb_build_object('allowed',false,'reason','no_license'); end if;
  if not coalesce(v.active,false) then
    return jsonb_build_object('allowed',false,'reason','revoked','kill_command',v.kill_command); end if;
  if v.hardware_uuid is not null and v.hardware_uuid <> p_hardware_uuid then
    return jsonb_build_object('allowed',false,'reason','hardware_mismatch','kill_command',v.kill_command); end if;
  if v.valid_until is not null and v.valid_until < now() then
    return jsonb_build_object('allowed',false,'reason','expired','kill_command',v.kill_command); end if;
  update public.organization_licenses set last_heartbeat_at = now() where organization_id = p_org;
  return jsonb_build_object('allowed',true);
end $function$
;

CREATE OR REPLACE FUNCTION public.lock_expired_assignments(p_org_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n integer;
BEGIN
  IF NOT (public.is_org_dispatcher(p_org_id) OR public.is_staff()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH locked AS (
    UPDATE public.incident_assignments
       SET status = 'locked', locked_at = now()
     WHERE org_id = p_org_id
       AND status = 'pending'
       AND created_at < (now() - interval '30 seconds')
    RETURNING 1
  )
  SELECT count(*) INTO n FROM locked;
  RETURN n;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_case_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.case_status_history (case_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid (), NULL);
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_change(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_audit_id  bigint;
  v_event_id  uuid;
  v_action    text;
  v_summary   text;
BEGIN
  v_action  := coalesce(payload->>'change_type', 'update');
  v_summary := coalesce(payload->>'summary', payload->>'what_changed', 'Change logged');

  -- 1. Permanent audit record
  INSERT INTO public.audit_events (action, payload)
  VALUES (v_action, payload)
  RETURNING id INTO v_audit_id;

  -- 2. Mesh-visible memory event (all agents can query this)
  INSERT INTO public.memory_events (
    actor_kind,
    actor_label,
    source,
    action,
    summary,
    details
  ) VALUES (
    coalesce(payload->>'actor_kind', 'human'),
    coalesce(payload->>'logged_by', 'staff'),
    coalesce(payload->>'source_node', 'slack'),
    v_action,
    v_summary,
    payload
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'audit_id',   v_audit_id,
    'event_id',   v_event_id,
    'action',     v_action,
    'summary',    v_summary
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mint_install_token(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_token text;
  v_now timestamptz := now();
begin
  if not exists (select 1 from organization_licenses where organization_id = p_org) then
    return jsonb_build_object('status','denied','reason','no_license');
  end if;

  v_token := encode(gen_random_bytes(18),'hex');   -- 36-char one-time secret

  update organization_licenses
     set install_token_hash = encode(digest(v_token,'sha256'),'hex'),
         install_token_used = false,
         updated_at = v_now
   where organization_id = p_org;

  insert into audit_events(organization_id, hardware_uuid, ip, action, payload)
    values (p_org, null, null, 'install_token_minted', jsonb_build_object('at', v_now));

  return jsonb_build_object('status','ok','install_token',v_token,
                            'note','shown once â€” hand to operator, never store the plaintext');
end $function$
;

CREATE OR REPLACE FUNCTION public.moe_portal_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.money_meter_record(p_org uuid, p_direction text, p_category text, p_amount numeric, p_source text DEFAULT NULL::text, p_ref text DEFAULT NULL::text, p_dedupe text DEFAULT NULL::text, p_meta jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_billable boolean := true;
  v_free     boolean := false;
  v_id       bigint;
begin
  if p_direction not in ('collected','used','saved') then
    raise exception 'money_meter_record: invalid direction %', p_direction;
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'money_meter_record: amount must be non-negative';
  end if;

  if p_org is not null then
    select free_forever into v_free from public.money_meter_accounts where org_id = p_org;
    if coalesce(v_free, false) and p_direction = 'used' then
      v_billable := false;
    end if;
  end if;

  insert into public.money_meter_events
      (org_id, direction, category, amount_usd, billable, source, ref, dedupe_key, meta)
    values (p_org, p_direction, p_category, p_amount, v_billable, p_source, p_ref, p_dedupe, p_meta)
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if p_dedupe is not null and v_id is null then
    return jsonb_build_object('recorded', false, 'reason', 'duplicate');
  end if;

  return jsonb_build_object('recorded', true, 'id', v_id, 'billable', v_billable);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.money_meter_summary(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'collected',    coalesce(sum(amount_usd) filter (where direction = 'collected'), 0),
    'usedBillable', coalesce(sum(amount_usd) filter (where direction = 'used' and billable), 0),
    'usedAll',      coalesce(sum(amount_usd) filter (where direction = 'used'), 0),
    'saved',        coalesce(sum(amount_usd) filter (where direction = 'saved'), 0)
  )
  from public.money_meter_events
  where p_since is null or occurred_at >= p_since;
$function$
;

CREATE OR REPLACE FUNCTION public.money_meter_summary_by_category(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(category text, collected numeric, used_billable numeric, used_all numeric, saved numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    category,
    coalesce(sum(amount_usd) filter (where direction = 'collected'), 0)              as collected,
    coalesce(sum(amount_usd) filter (where direction = 'used' and billable), 0)      as used_billable,
    coalesce(sum(amount_usd) filter (where direction = 'used'), 0)                   as used_all,
    coalesce(sum(amount_usd) filter (where direction = 'saved'), 0)                  as saved
  from public.money_meter_events
  where p_since is null or occurred_at >= p_since
  group by category
  order by (
    coalesce(sum(amount_usd) filter (where direction = 'collected'), 0)
    + coalesce(sum(amount_usd) filter (where direction = 'used'), 0)
    + coalesce(sum(amount_usd) filter (where direction = 'saved'), 0)
  ) desc;
$function$
;

CREATE OR REPLACE FUNCTION public.my_operator_book(p_operator uuid)
 RETURNS TABLE(referral_id uuid, vertical text, status text, commission_cents integer, mine boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select pr.id, pr.reason, pr.status, pr.commission_cents,
         (pr.affiliate_user_id = p_operator) as mine
  from public.partner_referrals pr
  where (pr.status = 'pending' and pr.affiliate_user_id is null and pr.consent_captured_at is not null)
     or pr.affiliate_user_id = p_operator
$function$
;

CREATE OR REPLACE FUNCTION public.my_operator_earnings(p_operator uuid)
 RETURNS TABLE(period_start date, period_end date, operator_cents integer, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select period_start, period_end, operator_cents, status
  from public.revenue_splits where operator_id = p_operator order by period_start desc
$function$
;

CREATE OR REPLACE FUNCTION public.next_case_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) + 1 INTO n FROM public.cases;
  RETURN 'TMMT-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.next_dsp_ref_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) + 1 INTO n FROM public.incidents;
  RETURN 'DSP-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.next_ref_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) + 1 INTO n FROM public.cases;
  RETURN 'TMMT-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_phone_e164(raw text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  digits text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  IF length(digits) = 10 THEN
    RETURN '+1' || digits;
  ELSIF length(digits) = 11 AND left(digits,1) = '1' THEN
    RETURN '+' || digits;
  ELSIF length(digits) >= 7 THEN
    RETURN '+' || digits;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_fleet_vehicle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.automation_outbox
    (automation, to_address, subject, body, source_table, record_id, org_id)
  values (
    'notify-team-new-fleet-vehicle', 'tmmtautodetail@gmail.com',
    'New Vehicle Added To Fleet',
    'A new vehicle was added to the fleet.' || E'\n\n'
      || '- Vehicle: ' || coalesce(new.vehicle_name, '(unnamed)') || E'\n'
      || '- Make/Model: ' || coalesce(new.vehicle_make, '') || ' ' || coalesce(new.vehicle_model, '') || E'\n'
      || '- Year: ' || coalesce(new.year::text, '') || E'\n'
      || '- Plate: ' || coalesce(new.license_plate, '') || E'\n'
      || '- Status: ' || coalesce(new.vehicle_status, ''),
    'fleet', new.id::text, new.org_id
  );
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.on_new_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- status default, Airtable's updateRecord step
  if coalesce(new.status, '') = '' then
    update public.incoming_leads set status = 'New Lead' where id = new.id;
  end if;

  insert into public.automation_outbox
    (automation, to_address, subject, body, source_table, record_id, org_id)
  values (
    'notify-new-lead', 'tmmtautodetail@gmail.com',
    'New Lead Added Notification',
    'A new lead has been added.' || E'\n\n'
      || '- Contact Name: ' || coalesce(new.contact_name, '') || E'\n'
      || '- Email: ' || coalesce(new.email, '') || E'\n'
      || '- Opportunity Name: ' || coalesce(new.opportunity_name, ''),
    'incoming_leads', new.id::text, new.org_id
  );
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.onboard_org_member(p_email text, p_org_id uuid, p_role text DEFAULT 'operator'::text)
 RETURNS org_roles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid; v_row public.org_roles;
begin
  -- authenticated non-staff cannot onboard; staff + trusted backend (no auth.uid) may.
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Only staff/owner can onboard org members';
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'Org % does not exist', p_org_id;
  end if;
  select id into v_uid from public.profiles where lower(email) = lower(p_email) limit 1;
  if v_uid is null then
    raise exception 'No profile for email % â€” have them sign up first, then onboard', p_email;
  end if;
  insert into public.org_roles(org_id, user_id, role)
  values (p_org_id, v_uid, p_role)
  on conflict (org_id, user_id, role) do nothing;
  select * into v_row from public.org_roles where org_id = p_org_id and user_id = v_uid and role = p_role;
  return v_row;
end $function$
;

CREATE OR REPLACE FUNCTION public.operator_academy_complete(p_profile_id uuid, p_track text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select not exists (
    select 1 from public.operator_training_modules m
    where m.active = true and m.track in ('core', p_track, 'capstone')
      and not exists (
        select 1 from public.operator_training_progress p
        where p.profile_id = p_profile_id and p.module_id = m.id
          and p.percent_complete >= 100 and p.completed_at is not null
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.operator_checkin(p_org uuid, p_hardware_uuid text, p_key_hash text, p_action text DEFAULT 'heartbeat'::text, p_ip inet DEFAULT NULL::inet, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lic organization_licenses%rowtype;
  v_mode text;
  v_violation text := null;
  v_now timestamptz := now();
  v_enforced boolean := false;
begin
  select mode into v_mode from enforcement_settings where id;
  select * into v_lic from organization_licenses where organization_id = p_org;

  if not found then
    insert into audit_events(organization_id, hardware_uuid, ip, action, payload)
      values (null, p_hardware_uuid, p_ip, 'violation:no_license',
              coalesce(p_payload,'{}'::jsonb)
              || jsonb_build_object('mode', v_mode, 'attempted_org', p_org));
    return jsonb_build_object('status','denied','reason','no_license','mode',v_mode);
  end if;

  if v_lic.license_key_hash is distinct from p_key_hash then
    v_violation := 'bad_key';
  elsif v_lic.hardware_uuid is not null
        and v_lic.hardware_uuid is distinct from p_hardware_uuid then
    v_violation := 'hardware_mismatch';
  elsif v_lic.valid_until is not null and v_lic.valid_until < v_now then
    v_violation := 'expired';
  elsif not v_lic.active then
    v_violation := 'inactive';
  elsif p_action like 'policy:%' then
    v_violation := p_action;
  end if;

  if v_violation is not null then
    v_enforced := (v_mode = 'live' and not coalesce(v_lic.internal_protected,false));
    insert into audit_events(organization_id, hardware_uuid, ip, action, payload)
      values (p_org, p_hardware_uuid, p_ip, 'violation:'||v_violation,
              coalesce(p_payload,'{}'::jsonb)
              || jsonb_build_object('mode', v_mode,
                                    'would_disable', not coalesce(v_lic.internal_protected,false),
                                    'enforced', v_enforced));
    if v_enforced then
      update organization_licenses set active = false, updated_at = v_now
        where organization_id = p_org;
    end if;
    return jsonb_build_object('status','offline','reason',v_violation,
                              'mode',v_mode,'enforced',v_enforced);
  end if;

  update organization_licenses
    set last_heartbeat_at = v_now,
        hardware_uuid = coalesce(hardware_uuid, p_hardware_uuid),
        updated_at = v_now
    where organization_id = p_org;
  insert into audit_events(organization_id, hardware_uuid, ip, action, payload)
    values (p_org, p_hardware_uuid, p_ip, 'checkin_ok',
            coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('mode', v_mode));
  return jsonb_build_object('status','ok','heartbeat_at',v_now,'mode',v_mode);
end $function$
;

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
end $function$
;

CREATE OR REPLACE FUNCTION public.operator_self_certify()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid          uuid := auth.uid();
  v_op_id        uuid;
  v_certified_at timestamptz;
  v_total        int;
  v_done         int;
begin
  if v_uid is null then
    return jsonb_build_object('certified', false, 'reason', 'not_signed_in');
  end if;

  select id, certified_at into v_op_id, v_certified_at
  from public.operator_profiles
  where profile_id = v_uid
  limit 1;

  if v_op_id is null then
    return jsonb_build_object('certified', false, 'reason', 'no_operator_profile');
  end if;

  if v_certified_at is not null then
    return jsonb_build_object('certified', true, 'already', true);
  end if;

  select count(*) into v_total
  from public.operator_training_modules m
  where coalesce(m.active, true);

  select count(*) into v_done
  from public.operator_training_modules m
  join public.operator_training_progress p
    on p.module_id = m.id
   and p.profile_id = v_uid
   and p.percent_complete >= 100
   and p.completed_at is not null
  where coalesce(m.active, true);

  if v_total = 0 or v_done < v_total then
    return jsonb_build_object(
      'certified', false,
      'reason', 'incomplete',
      'completed', v_done,
      'total', v_total
    );
  end if;

  update public.operator_profiles
  set level        = 'certified'::operator_level,
      certified_at = now(),
      rubric_score = greatest(rubric_score, 100),
      metadata     = coalesce(metadata, '{}'::jsonb)
                     || jsonb_build_object('certified_via', 'self_attested',
                                           'self_certified_at', now()),
      updated_at   = now()
  where id = v_op_id
    and certified_at is null
    and level = 'candidate';

  if not found then
    return jsonb_build_object('certified', true, 'already', true);
  end if;

  return jsonb_build_object('certified', true, 'already', false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.org_has_module(p_module text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (
      select case
        when ol.license_tier = 'full_os' then true
        when p_module = any (ol.modules) then true
        else false
      end
      from public.profiles p
      left join public.organization_licenses ol on ol.organization_id = p.organization_id
      where p.id = auth.uid()
      limit 1
    ),
    true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.org_id_for_host(p_host text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select d.org_id
  from public.organization_domains d
  where d.hostname = lower(split_part(coalesce(p_host, ''), ':', 1))
    and d.verified_at is not null
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.partner_business_owner_eligible(p_has_capital boolean, p_vehicle_count integer)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select true;
$function$
;

CREATE OR REPLACE FUNCTION public.partner_pct_from_tier(p_tier partner_revenue_split_tier)
 RETURNS smallint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case p_tier
    when '90_10' then 90
    when '80_20' then 80
    when '70_30' then 70
    when '60_40' then 60
    when '50_50' then 50
    else 50
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.partner_retail_eligible(p_has_own_system boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(p_has_own_system, false);
$function$
;

CREATE OR REPLACE FUNCTION public.partner_tier_allowed_for_segment(p_segment partner_client_segment, p_tier partner_revenue_split_tier, p_has_own_system boolean, p_has_capital boolean DEFAULT false, p_vehicle_count integer DEFAULT 0)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when p_segment is null or p_tier is null then false
    when p_segment = 'retail' then
      p_tier in ('90_10', '80_20', '70_30')
      and public.partner_retail_eligible(p_has_own_system)
    when p_segment = 'business_owner' then
      p_tier in ('60_40', '50_50')
      and public.partner_business_owner_eligible(p_has_capital, p_vehicle_count)
    else false
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.partner_vehicle_rentals()
 RETURNS TABLE(fleet_id uuid, vehicle_name text, license_plate text, vehicle_status text, partner_percentage numeric, booking_id uuid, ref_code text, renter_first_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, booking_status text, stage text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    f.id,
    f.vehicle_name,
    f.license_plate,
    f.vehicle_status,
    f.partner_percentage,
    b.id,
    b.ref_code,
    nullif(split_part(btrim(coalesce(b.customer_name, '')), ' ', 1), ''),
    b.starts_at,
    b.ends_at,
    b.status,
    case
      when b.id is null                                   then 'unpaired'
      when b.starts_at is not null and now() < b.starts_at then 'upcoming'
      when b.ends_at is null or now() <= b.ends_at         then 'active'
      else                                                      'returned'
    end
  from public.fleet f
  join public.partner_fleet_access pfa
    on pfa.fleet_id = f.id
   and pfa.partner_user_id = auth.uid()
  left join public.bookings b
    on b.vehicle_id = f.id
  where public.is_partner()
  order by f.vehicle_name, b.starts_at desc nulls last;
$function$
;

CREATE OR REPLACE FUNCTION public.pick_idle_closer(p_org uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select p.id
  from public.profiles p
  where p.organization_id = p_org
    and p.portal_role = 'team_member'
    and p.role = 'internal_team'
    and coalesce(p.team_department::text,'general') in ('sales','support','general')
  order by public.agent_open_load(p.id) asc, random()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.pick_next_closer(p_org uuid)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.user_id
  from public.org_roles r
  join auth.users u on u.id = r.user_id
  where r.org_id = p_org and r.role = 'responder'
    and (u.banned_until is null or u.banned_until < now())
  order by (select count(*) from public.incoming_leads l
             where l.assigned_to = r.user_id and l.agent_status = 'NEW') asc,
           random()
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.program_applications_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.promote_ghl_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_digits text;
  v_e164   text;
  v_phone10 text;
  v_org    uuid;
  v_dnd    boolean;
  v_blocked boolean := false;
  v_closer uuid;
begin
  v_digits := nullif(regexp_replace(coalesce(new.raw_payload->>'phone',''),'[^0-9]','','g'),'');
  -- no dialable phone (e.g. IG-username lead) -> leave in ghl_contacts, do not create a dial lead
  if v_digits is null or length(v_digits) not in (10,11) then
    return new;
  end if;
  v_phone10 := right(v_digits,10);
  v_e164 := '+1' || v_phone10;
  v_org := coalesce(new.organization_id, '8e651b25-e7c8-4356-af64-1716a82053b0');
  v_dnd := coalesce((new.raw_payload->>'dnd')::boolean, false);

  -- idempotent: skip if this number is already a workable lead
  if exists (select 1 from public.incoming_leads l where l.phone_e164 = v_e164) then
    return new;
  end if;

  -- DNC / DND gate: record the lead but never auto-assign or dial it
  if v_dnd or exists (select 1 from public.do_not_contact_numbers d where d.phone10 = v_phone10) then
    v_blocked := true;
  end if;

  if not v_blocked then
    v_closer := public.pick_next_closer(v_org);
  end if;

  insert into public.incoming_leads
    (contact_name, phone_e164, phone_text, source, source_medium, organization_id,
     agent_status, opted_out, assigned_to, assigned_at, assignment_source, created_on, notes)
  values
    (nullif(new.full_name,''), v_e164, v_e164,
     coalesce(new.raw_payload->'attributions'->0->>'medium', new.raw_payload->>'source'),
     coalesce(new.raw_payload->'attributions'->0->>'medium', new.raw_payload->>'source'),
     v_org, 'NEW', v_blocked,
     v_closer, case when v_closer is not null then now() end,
     case when v_blocked then 'auto-blocked-dnc' when v_closer is not null then 'auto-roundrobin' else 'auto-unassigned' end,
     coalesce((new.raw_payload->>'dateAdded')::timestamptz, now()),
     'Auto-promoted from GHL contact ' || coalesce(new.raw_payload->>'id','?') || ' on ' || now()::date);
  return new;
exception when others then
  raise warning 'promote_ghl_contact skipped for %: %', new.id, sqlerrm;
  return new;  -- never break the GHL sync
end;
$function$
;

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
end $function$
;

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
end $function$
;

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
  values (coalesce(p_name, p_email) || ' â€” ' || coalesce(p_city, 'HQ'), 'tmmt', p_vertical::org_vertical, p_plan_tier, 'active')
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
end $function$
;

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
end $function$
;

CREATE OR REPLACE FUNCTION public.rank_work_candidates(p_case_id uuid)
 RETURNS TABLE(candidate_id uuid, candidate_kind text, display_name text, score numeric, cap_overlap integer, vertical_match boolean, current_load integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH c AS (
    SELECT coalesce(required_capabilities, '{}'::text[]) AS req,
           business_line AS vert, org_id
    FROM public.cases WHERE id = p_case_id
  )
  SELECT
    rc.id, rc.candidate_kind, rc.display_name,
    ( (SELECT count(*) FROM unnest(rc.capability_tags) t WHERE t = ANY (c.req))::numeric * 10
      + (CASE WHEN c.vert IS NOT NULL AND c.vert = ANY (rc.vertical_slugs) THEN 5 ELSE 0 END)
      + rc.priority_weight
      - rc.current_load * 2 ) AS score,
    (SELECT count(*) FROM unnest(rc.capability_tags) t WHERE t = ANY (c.req))::int AS cap_overlap,
    (c.vert IS NOT NULL AND c.vert = ANY (rc.vertical_slugs)) AS vertical_match,
    rc.current_load
  FROM public.routing_candidates rc, c
  WHERE rc.status = 'available'
    AND rc.current_load < rc.max_concurrent
    AND (c.org_id IS NULL OR rc.org_id IS NULL OR rc.org_id = c.org_id)
    AND (
      cardinality(c.req) = 0
      OR rc.capability_tags && c.req
      OR (c.vert IS NOT NULL AND c.vert = ANY (rc.vertical_slugs))
    )
  ORDER BY score DESC, rc.current_load ASC
  LIMIT 10;
$function$
;

CREATE OR REPLACE FUNCTION public.rebalance_all_orgs(p_max_age interval DEFAULT '04:00:00'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; total int := 0;
begin
  for r in select id from public.organizations loop
    total := total + coalesce(public.rebalance_stale_leads(r.id, p_max_age),0);
  end loop;
  return total;
end $function$
;

CREATE OR REPLACE FUNCTION public.rebalance_stale_leads(p_org uuid, p_max_age interval DEFAULT '04:00:00'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_new uuid; v_count int := 0;
begin
  for r in
    select id from incoming_leads
    where organization_id = p_org and assigned_to is not null
      and contacted_at is null and lower(coalesce(status,'new')) = 'new'
      and assigned_at < now() - p_max_age
    for update skip locked
  loop
    v_new := pick_idle_closer(p_org);
    if v_new is not null then
      update incoming_leads set assigned_to = v_new, assigned_at = now(), assignment_source = 'rebalance' where id = r.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $function$
;

CREATE OR REPLACE FUNCTION public.recall_memory_facts_local(p_org uuid, p_query text, p_k integer DEFAULT 6)
 RETURNS TABLE(id uuid, fact text, confidence real, score real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare q vector(768);
begin
  if auth.uid() is not null and not (public.is_staff() or public.is_owner()) then
    return;
  end if;
  q := p_query::vector(768);
  return query
    select f.id, f.fact, f.confidence, (1 - (f.embedding_local <=> q))::real as score
    from public.memory_facts f
    where f.embedding_local is not null
      and f.valid_to is null
      and (p_org is null or f.org_id = p_org)
    order by f.embedding_local <=> q
    limit greatest(1, least(coalesce(p_k, 6), 25));
end $function$
;

CREATE OR REPLACE FUNCTION public.recall_memory_local(p_org uuid, p_query text, p_k integer DEFAULT 6)
 RETURNS TABLE(id uuid, summary text, action text, occurred_at timestamp with time zone, score real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare q vector(768);
begin
  if auth.uid() is not null and not (public.is_staff() or public.is_owner()) then
    return;
  end if;
  q := p_query::vector(768);
  return query
    select e.id, e.summary, e.action, e.occurred_at,
           (1 - (e.embedding_local <=> q))::real as score
    from public.memory_events e
    where e.embedding_local is not null
      and (p_org is null or e.org_id = p_org)
    order by e.embedding_local <=> q
    limit greatest(1, least(coalesce(p_k, 6), 25));
end $function$
;

CREATE OR REPLACE FUNCTION public.recompute_journey(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare v_email text := lower(trim(p_email)); v_journey_id uuid; v_profile_id uuid; v_gs boolean; v_gs_since timestamptz; v_days int; v_lto boolean; begin if v_email is null or v_email = '' then return null; end if; select id into v_profile_id from public.profiles where lower(email) = v_email limit 1; select id into v_journey_id from public.client_journey where lower(customer_email) = v_email; if v_journey_id is null then insert into public.client_journey (customer_email, profile_id) values (v_email, v_profile_id) returning id into v_journey_id; else update public.client_journey set profile_id = coalesce(v_profile_id, profile_id), updated_at = now() where id = v_journey_id; end if; v_gs := public.compute_good_standing(v_email); select good_standing_since into v_gs_since from public.client_journey where id = v_journey_id; if v_gs then if v_gs_since is null then v_gs_since := now(); end if; v_days := greatest(0, (now()::date - v_gs_since::date)); else v_gs_since := null; v_days := 0; end if; update public.client_journey set good_standing = v_gs, good_standing_since = case when v_gs then coalesce(good_standing_since, now()) else null end, good_standing_days = v_days, updated_at = now() where id = v_journey_id; if v_gs and v_days >= 90 then insert into public.journey_checkpoint_events (journey_id, checkpoint_slug, evidence) values (v_journey_id, 'day_90_good_standing', jsonb_build_object('days', v_days)) on conflict (journey_id, checkpoint_slug) do nothing; end if; v_lto := public.compute_lto_eligible(v_profile_id, v_email); update public.client_journey set lto_eligible = v_lto, program_track = case when v_lto and program_track = 'renter' then 'lto'::public.program_track else program_track end, updated_at = now() where id = v_journey_id; return v_journey_id; end; $function$
;

CREATE OR REPLACE FUNCTION public.reinstate_license(p_org uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.organization_licenses set active = true, updated_at = now() where organization_id = p_org;
end $function$
;

CREATE OR REPLACE FUNCTION public.request_handoff(p_source_org text, p_dest_org text, p_contact_ref text, p_reason text, p_consent_channel text DEFAULT NULL::text, p_commission_cents integer DEFAULT NULL::integer)
 RETURNS partner_referrals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.partner_referrals;
  v_commission integer;
begin
  if coalesce(btrim(p_contact_ref), '') = '' then
    raise exception 'p_contact_ref (the client) is required';
  end if;

  -- Non-staff/non-service callers may request a handoff but may NOT
  -- self-declare their own commission. Force it to NULL; staff/service set
  -- it later on review.
  if auth.role() = 'service_role' or public.is_staff() then
    v_commission := p_commission_cents;
  else
    v_commission := null;
  end if;

  insert into public.partner_referrals
    (source_org, dest_org, source_contact_ref, reason, status,
     consent_captured_at, consent_channel, commission_cents)
  values
    (p_source_org, p_dest_org, p_contact_ref, p_reason, 'pending',
     case when p_consent_channel is not null then now() else null end,
     p_consent_channel, v_commission)
  returning * into v_row;   -- org/self-referral CHECK constraints enforce validity

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_license(p_org uuid, p_reason text DEFAULT 'manual'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.organization_licenses
     set active = false, kill_command = 'wipe', updated_at = now()
   where organization_id = p_org;
end $function$
;

CREATE OR REPLACE FUNCTION public.route_intake_event(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare e record; pr record;
begin
  select * into e from public.intake_events where id = p_id;
  if not found then raise exception 'route_intake_event: % not found', p_id; end if;
  if e.program is null then
    return jsonb_build_object('id', p_id, 'routed', false, 'reason', 'unresolved');
  end if;

  select * into pr from public.programs where slug = e.program;

  -- Stamp the originating record so the program is visible where people work.
  -- `source` is left alone: it records how the lead arrived, not what they want.
  if e.source = 'incoming_leads' and e.record_id is not null then
    update public.incoming_leads
       set program = coalesce(program, pr.slug),
           lane    = coalesce(lane, pr.lane)
     where id = e.record_id::uuid;
  end if;

  update public.intake_events
     set routed_at = now(), routed_action = pr.next_action
   where id = p_id;

  return jsonb_build_object(
    'id', p_id, 'routed', true, 'program', pr.slug, 'lane', pr.lane,
    'destination', pr.destination, 'owner', pr.owner_role, 'action', pr.next_action
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_customer_intake(p_contact_name text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_request_type text DEFAULT 'rental_inquiry'::text, p_description text DEFAULT NULL::text, p_priority text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_case_id uuid;
  v_intake_id uuid;
  v_ref_code text;
  v_subject text;
BEGIN
  IF length(trim(coalesce(p_contact_name, ''))) < 1 THEN
    RAISE EXCEPTION 'contact_name required';
  END IF;

  -- Input caps: anon-callable via PostgREST, so this cannot rely on client validation.
  IF length(coalesce(p_contact_name, ''))  > 200
     OR length(coalesce(p_phone, ''))        > 40
     OR length(coalesce(p_email, ''))        > 254
     OR length(coalesce(p_request_type, '')) > 100
     OR length(coalesce(p_description, ''))  > 4000
     OR length(coalesce(p_priority, ''))     > 40 THEN
    RAISE EXCEPTION 'submit_customer_intake: field too long';
  END IF;

  v_ref_code := public.next_ref_code ();
  v_subject := trim(p_contact_name) || ' â€” ' || coalesce(nullif(trim(p_request_type), ''), 'inquiry');
  v_case_id := gen_random_uuid ();

  INSERT INTO public.customer_intake_forms (
    customer_name, customer_email, customer_phone,
    request_type, subject, details, source, payload
  )
  VALUES (
    trim(p_contact_name),
    nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    coalesce(nullif(trim(p_request_type), ''), 'general'),
    v_subject,
    nullif(trim(p_description), ''),
    'web',
    jsonb_build_object('priority', nullif(trim(p_priority), ''))
  )
  RETURNING id INTO v_intake_id;

  INSERT INTO public.cases (
    id, ref_code, intake_id, customer_name, customer_email, customer_phone,
    request_type, subject, description, status, routing_status, metadata
  )
  VALUES (
    v_case_id, v_ref_code, v_intake_id,
    trim(p_contact_name),
    nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    coalesce(nullif(trim(p_request_type), ''), 'general'),
    v_subject,
    nullif(trim(p_description), ''),
    'intake_submitted',
    'pending',
    jsonb_build_object('priority', nullif(trim(p_priority), ''))
  );

  INSERT INTO public.case_status_history (case_id, from_status, to_status, note)
  VALUES (v_case_id, NULL, 'intake_submitted', 'Created from customer intake');

  RETURN v_case_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sweep_overdue_payments()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare n integer;
begin
  with bumped as (
    update public.customer_payments
       set payment_status = 'Overdue', updated_at = now()
     where next_payment_due_date is not null
       and next_payment_due_date <= current_date
       and coalesce(payment_status, '') is distinct from 'Overdue'
    returning 1
  )
  select count(*) into n from bumped;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.sweep_payment_due_notices()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare n integer;
begin
  with queued as (
    insert into public.automation_outbox
      (automation, to_address, subject, body, source_table, record_id, org_id)
    select
      'notify-customer-payment-due',
      p.customer_phone_number,
      'Your payment is due today',
      'Hi ' || coalesce(p.customer_name, p.customer, 'there') || E',\n\n'
        || 'A payment of ' || coalesce(p.amount::text, '') || ' is due today ('
        || coalesce(p.next_payment_due_date::text, '') || ').' || E'\n\nThank you.',
      'customer_payments', p.id::text, p.org_id
    from public.customer_payments p
    where p.next_payment_due_date = current_date
      and coalesce(p.customer_phone_number, '') <> ''
      and not exists (
        select 1 from public.automation_outbox o
        where o.automation = 'notify-customer-payment-due'
          and o.record_id = p.id::text
          and o.created_at::date = current_date
      )
    returning 1
  )
  select count(*) into n from queued;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.tasks_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_attrib_affiliate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_op uuid; v_ref text;
begin
  v_ref := coalesce(new.affiliate_code, new.utm_source, new.utm_content);
  if new.affiliate_operator_id is null and v_ref is not null then
    select operator_id into v_op from public.affiliate_links where code = v_ref and active limit 1;
    if v_op is not null then
      new.affiliate_operator_id := v_op;
      new.affiliate_code := v_ref;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_auto_assign_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_closer uuid;
begin
  if new.assigned_to is null
     and lower(coalesce(new.status,'new')) = 'new'
     and new.organization_id is not null
     and lower(coalesce(new.lead_verification,'')) in ('verified','valid','true')
  then
    v_closer := pick_idle_closer(new.organization_id);
    if v_closer is not null then
      new.assigned_to := v_closer; new.assigned_at := now(); new.assignment_source := 'auto_idle';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_notify_handoff_slack()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_secret text := null;
  v_url    text := 'https://uapxakmlwnpfsftfeezx.supabase.co/functions/v1/handoff-slack-notify';
begin
  -- Only notify on creation, status change, or consent being captured.
  if TG_OP = 'UPDATE'
     and NEW.status is not distinct from OLD.status
     and NEW.consent_captured_at is not distinct from OLD.consent_captured_at then
    return NEW;
  end if;

  -- Optional shared secret (set vault secret 'handoff_hook_secret' to enable auth).
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'handoff_hook_secret'
    limit 1;
  exception when others then
    v_secret := null;
  end;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
                 'type', TG_OP,
                 'table', 'partner_referrals',
                 'record', to_jsonb(NEW),
                 'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
               ),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-handoff-secret', coalesce(v_secret, '')
               )
  );

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_validate_and_verify_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_phone text; v_dupe uuid;
begin
  v_phone := regexp_replace(coalesce(new.phone_text, new.phone::text, new.phone_e164, ''), '\D', '', 'g');

  -- DEDUP: same email or phone in same org within 30 days => mark duplicate, don't route
  select id into v_dupe
  from public.incoming_leads
  where organization_id = new.organization_id
    and (
      (new.email is not null and lower(email) = lower(new.email))
      or (length(v_phone) >= 10
          and regexp_replace(coalesce(phone_text, phone::text, phone_e164, ''), '\D','','g') = v_phone)
    )
    and created_at > now() - interval '30 days'
  limit 1;

  if v_dupe is not null then
    new.lead_verification := 'duplicate';
    return new;
  end if;

  -- VALIDATE: only auto-verify leads that look real (routes); else hold for human (no route)
  if new.lead_verification is null then
    if (new.email is not null and new.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') and length(v_phone) >= 10 then
      new.lead_verification := 'verified';
    else
      new.lead_verification := 'unverified';
    end if;
  end if;

  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tmmt_token_grant(p_org uuid, p_amount integer, p_reason text, p_dedupe text DEFAULT NULL::text, p_set_allotment integer DEFAULT NULL::integer, p_tier text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event_id bigint;
  v_balance  integer;
begin
  -- Staff or service role only â€” any authenticated user could otherwise
  -- grant their own org free paid-tier tokens.
  if auth.role() <> 'service_role' and not public.is_staff() then
    raise exception 'tmmt_token_grant: staff or service role only';
  end if;

  if p_amount < 0 then
    raise exception 'tmmt_token_grant: amount must be non-negative';
  end if;

  insert into public.tmmt_token_events (org_id, delta, reason, dedupe_key)
    values (p_org, p_amount, p_reason, p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if p_dedupe is not null and v_event_id is null then
    select balance into v_balance from public.tmmt_token_balances where org_id = p_org;
    return jsonb_build_object('granted', false, 'reason', 'duplicate', 'balance', coalesce(v_balance, 0));
  end if;

  insert into public.tmmt_token_balances as b
      (org_id, balance, monthly_allotment, plan_tier, last_topup_at)
    values (p_org, p_amount, coalesce(p_set_allotment, p_amount), coalesce(p_tier, 'member'), now())
  on conflict (org_id) do update
    set balance           = b.balance + p_amount,
        monthly_allotment = coalesce(p_set_allotment, b.monthly_allotment),
        plan_tier         = coalesce(p_tier, b.plan_tier),
        last_topup_at     = now(),
        updated_at        = now()
  returning b.balance into v_balance;

  update public.tmmt_token_events set balance_after = v_balance where id = v_event_id;

  return jsonb_build_object('granted', true, 'balance', v_balance);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tmmt_token_spend(p_org uuid, p_cost integer, p_job text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_unlimited boolean;
  v_status    text;
  v_balance   integer;
begin
  -- Authorization guard. Mirrors tmmt_token_grant.
  -- service_role / no-JWT (pg_cron, psql) pass through; a JWT caller must
  -- belong to the org being debited, or be staff acting on their behalf.
  if auth.role() is distinct from 'service_role'
     and auth.role() is not null
     and not public.is_org_member(p_org)
     and not public.is_staff() then
    raise exception 'tmmt_token_spend: caller is not a member of org %', p_org
      using errcode = '42501';
  end if;

  if p_cost < 0 then
    raise exception 'tmmt_token_spend: cost must be non-negative';
  end if;

  select unlimited, status, balance into v_unlimited, v_status, v_balance
    from public.tmmt_token_balances where org_id = p_org;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'no_account', 'balance', 0);
  end if;
  if v_status <> 'active' then
    return jsonb_build_object('allowed', false, 'reason', 'suspended', 'balance', v_balance);
  end if;
  if v_unlimited then
    insert into public.tmmt_token_events (org_id, delta, reason, job_ref, balance_after)
      values (p_org, 0, 'spend_unlimited', p_job, v_balance);
    return jsonb_build_object('allowed', true, 'unlimited', true, 'balance', v_balance);
  end if;

  update public.tmmt_token_balances
    set balance = balance - p_cost, updated_at = now()
    where org_id = p_org and balance >= p_cost
  returning balance into v_balance;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'insufficient',
      'balance', (select balance from public.tmmt_token_balances where org_id = p_org));
  end if;

  insert into public.tmmt_token_events (org_id, delta, reason, job_ref, balance_after)
    values (p_org, -p_cost, 'spend', p_job, v_balance);

  return jsonb_build_object('allowed', true, 'unlimited', false, 'balance', v_balance);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_comm_channels_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.touch_customer_services_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_installations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.touch_memory_entity_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.training_core_complete(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select not exists (select 1 from public.training_modules m where m.is_core = true and m.active = true and not exists (select 1 from public.training_module_progress p where p.profile_id = p_profile_id and p.module_id = m.id and p.percent_complete >= 100 and p.completed_at is not null)); $function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

-- ============ 9. TRIGGERS ============
CREATE TRIGGER active_customers_set_updated_at BEFORE UPDATE ON public.active_customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointments_set_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER background_checks_set_updated_at BEFORE UPDATE ON public.background_checks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bills_touch_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION bills_touch_updated_at();
CREATE TRIGGER cases_set_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER cases_status_history BEFORE INSERT OR UPDATE OF status ON public.cases FOR EACH ROW EXECUTE FUNCTION log_case_status_change();
CREATE TRIGGER cases_status_history_trg BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION log_case_status_change();
CREATE TRIGGER trg_comm_channels_updated_at BEFORE UPDATE ON public.comm_channels FOR EACH ROW EXECUTE FUNCTION touch_comm_channels_updated_at();
CREATE TRIGGER contracts_set_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER crm_sync_records_set_updated BEFORE UPDATE ON public.crm_sync_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER customer_inspection_photos_set_updated_at BEFORE UPDATE ON public.customer_inspection_photos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER capture_form_intake_trg AFTER INSERT ON public.customer_intake_forms FOR EACH ROW EXECUTE FUNCTION capture_form_intake();
CREATE TRIGGER customer_payments_set_updated_at BEFORE UPDATE ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customer_services_updated_at BEFORE UPDATE ON public.customer_services FOR EACH ROW EXECUTE FUNCTION touch_customer_services_updated_at();
CREATE TRIGGER deals_touch BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER dispute_clients_set_updated_at BEFORE UPDATE ON public.dispute_clients FOR EACH ROW EXECUTE FUNCTION dispute_clients_touch_updated_at();
CREATE TRIGGER do_not_rent_list_set_updated_at BEFORE UPDATE ON public.do_not_rent_list FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER employee_access_rights_set_updated_at BEFORE UPDATE ON public.employee_access_rights FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER agent_enqueue_expenses AFTER INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION agent_enqueue();
CREATE TRIGGER expense_fill_from_vehicle_trg BEFORE INSERT OR UPDATE OF vehicle, vehicle_name ON public.expenses FOR EACH ROW EXECUTE FUNCTION expense_fill_from_vehicle();
CREATE TRIGGER expenses_set_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER fleet_set_updated_at BEFORE UPDATE ON public.fleet FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notify_new_fleet_vehicle_trg AFTER INSERT ON public.fleet FOR EACH ROW EXECUTE FUNCTION notify_new_fleet_vehicle();
CREATE TRIGGER fleet_car_inspections_set_updated_at BEFORE UPDATE ON public.fleet_car_inspections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER former_customers_set_updated_at BEFORE UPDATE ON public.former_customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER garage_builds_updated_at BEFORE UPDATE ON public.garage_builds FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ghl_appointments_updated BEFORE UPDATE ON public.ghl_appointments FOR EACH ROW EXECUTE FUNCTION ghl_appointments_set_updated();
CREATE TRIGGER ghl_contacts_updated BEFORE UPDATE ON public.ghl_contacts FOR EACH ROW EXECUTE FUNCTION ghl_contacts_set_updated();
CREATE TRIGGER trg_promote_ghl_contact AFTER INSERT ON public.ghl_contacts FOR EACH ROW EXECUTE FUNCTION promote_ghl_contact();
CREATE TRIGGER update_hailmary_licenses_updated_at BEFORE UPDATE ON public.hailmary_licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER capture_lead_intake_trg AFTER INSERT ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION capture_lead_intake();
CREATE TRIGGER incoming_leads_set_updated_at BEFORE UPDATE ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER lead_to_active_customer_trg AFTER INSERT OR UPDATE OF status ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION lead_to_active_customer();
CREATE TRIGGER on_new_lead_trg AFTER INSERT ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION on_new_lead();
CREATE TRIGGER trg_aa_validate_lead BEFORE INSERT ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION tg_validate_and_verify_lead();
CREATE TRIGGER trg_ab_affiliate_attrib BEFORE INSERT ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION tg_attrib_affiliate();
CREATE TRIGGER trg_auto_assign_lead BEFORE INSERT ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION tg_auto_assign_lead();
CREATE TRIGGER trg_leadnet_start_clock AFTER INSERT ON public.incoming_leads FOR EACH ROW EXECUTE FUNCTION leadnet_start_clock();
CREATE TRIGGER trg_installations_updated_at BEFORE UPDATE ON public.installations FOR EACH ROW EXECUTE FUNCTION touch_installations_updated_at();
CREATE TRIGGER insurance_set_updated_at BEFORE UPDATE ON public.insurance FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER agent_enqueue_intake_events AFTER INSERT ON public.intake_events FOR EACH ROW EXECUTE FUNCTION agent_enqueue();
CREATE TRIGGER auto_route_intake_trg AFTER INSERT OR UPDATE OF program ON public.intake_events FOR EACH ROW WHEN (((new.program IS NOT NULL) AND (new.routed_at IS NULL))) EXECUTE FUNCTION auto_route_intake();
CREATE TRIGGER maintenance_appointments_set_updated_at BEFORE UPDATE ON public.maintenance_appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_memory_entities_updated_at BEFORE UPDATE ON public.memory_entities FOR EACH ROW EXECUTE FUNCTION touch_memory_entity_updated_at();
CREATE TRIGGER operation_costs_set_updated_at BEFORE UPDATE ON public.operation_costs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_operator_cap_100 BEFORE INSERT ON public.operator_profiles FOR EACH ROW EXECUTE FUNCTION enforce_operator_cap();
CREATE TRIGGER trg_operator_cap_100_upd BEFORE UPDATE ON public.operator_profiles FOR EACH ROW WHEN ((COALESCE(((new.metadata ->> 'seat_paid'::text))::boolean, false) AND (NOT COALESCE(((old.metadata ->> 'seat_paid'::text))::boolean, false)))) EXECUTE FUNCTION enforce_operator_cap();
CREATE TRIGGER parties_touch BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER partner_app_endpoints_set_updated BEFORE UPDATE ON public.partner_app_endpoints FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enforce_handoff_consent BEFORE INSERT OR UPDATE ON public.partner_referrals FOR EACH ROW EXECUTE FUNCTION enforce_handoff_consent();
CREATE TRIGGER trg_notify_handoff_slack AFTER INSERT OR UPDATE ON public.partner_referrals FOR EACH ROW EXECUTE FUNCTION tg_notify_handoff_slack();
CREATE TRIGGER portal_clients_updated_at BEFORE UPDATE ON public.portal_clients FOR EACH ROW EXECUTE FUNCTION moe_portal_touch_updated_at();
CREATE TRIGGER program_applications_updated_at BEFORE UPDATE ON public.program_applications FOR EACH ROW EXECUTE FUNCTION program_applications_set_updated_at();
CREATE TRIGGER trg_routing_candidates_updated_at BEFORE UPDATE ON public.routing_candidates FOR EACH ROW EXECUTE FUNCTION touch_updated_at_generic();
CREATE TRIGGER shops_mechanics_cleaning_set_updated_at BEFORE UPDATE ON public.shops_mechanics_cleaning FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION tasks_set_updated_at();
CREATE TRIGGER tickets_set_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER vehicle_handover_set_updated_at BEFORE UPDATE ON public.vehicle_handover FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER vehicle_onboarding_inspections_set_updated_at BEFORE UPDATE ON public.vehicle_onboarding_inspections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER waitlist_set_updated_at BEFORE UPDATE ON public.waitlist FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_work_assignments_updated_at BEFORE UPDATE ON public.work_assignments FOR EACH ROW EXECUTE FUNCTION touch_updated_at_generic();

-- ============ 10. ROW LEVEL SECURITY ============
alter table public.active_customers enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_definitions enable row level security;
alter table public.agent_evaluation_sessions enable row level security;
alter table public.agent_evaluations enable row level security;
alter table public.agent_jobs enable row level security;
alter table public.agent_messages enable row level security;
alter table public.appointments enable row level security;
alter table public.assignment_overrides enable row level security;
alter table public.audit_events enable row level security;
alter table public.automation_outbox enable row level security;
alter table public.background_checks enable row level security;
alter table public.bills enable row level security;
alter table public.bookings enable row level security;
alter table public.case_client_updates enable row level security;
alter table public.case_status_history enable row level security;
alter table public.cases enable row level security;
alter table public.clickup_tasks enable row level security;
alter table public.client_alerts enable row level security;
alter table public.client_journey enable row level security;
alter table public.client_updates enable row level security;
alter table public.comm_channels enable row level security;
alter table public.contract_instances enable row level security;
alter table public.contracts enable row level security;
alter table public.coo_briefings enable row level security;
alter table public.counselor_escalation_state enable row level security;
alter table public.counselor_interaction enable row level security;
alter table public.counselor_profile enable row level security;
alter table public.counselor_profile_snapshot enable row level security;
alter table public.counselor_resistance_event enable row level security;
alter table public.counselor_session enable row level security;
alter table public.credit_billing_plans enable row level security;
alter table public.credit_education_acknowledgments enable row level security;
alter table public.credit_education_sections enable row level security;
alter table public.credit_enrollments enable row level security;
alter table public.credit_funding_sessions enable row level security;
alter table public.credit_payment_schedule enable row level security;
alter table public.credit_product_catalog enable row level security;
alter table public.crm_sync_records enable row level security;
alter table public.customer_inspection_photos enable row level security;
alter table public.customer_intake_forms enable row level security;
alter table public.customer_payments enable row level security;
alter table public.customer_payments_snapshot_20260706 enable row level security;
alter table public.customer_services enable row level security;
alter table public.customer_vehicles enable row level security;
alter table public.deal_payments enable row level security;
alter table public.dealer_applications enable row level security;
alter table public.deals enable row level security;
alter table public.detail_jobs enable row level security;
alter table public.detail_memberships enable row level security;
alter table public.dispute_clients enable row level security;
alter table public.do_not_contact_numbers enable row level security;
alter table public.do_not_rent_list enable row level security;
alter table public.documents enable row level security;
alter table public.employee_access_rights enable row level security;
alter table public.enforcement_settings enable row level security;
alter table public.entitlements enable row level security;
alter table public.exec_va_tasks enable row level security;
alter table public.expenses enable row level security;
alter table public.fleet enable row level security;
alter table public.fleet_car_inspections enable row level security;
alter table public.form_submissions enable row level security;
alter table public.former_customers enable row level security;
alter table public.garage_builds enable row level security;
alter table public.garage_gates enable row level security;
alter table public.garage_history enable row level security;
alter table public.garage_ledger enable row level security;
alter table public.garage_mods enable row level security;
alter table public.ghl_appointments enable row level security;
alter table public.ghl_contacts enable row level security;
alter table public.ghl_form_submissions enable row level security;
alter table public.hailmary_licenses enable row level security;
alter table public.incident_assignments enable row level security;
alter table public.incidents enable row level security;
alter table public.incoming_leads enable row level security;
alter table public.installations enable row level security;
alter table public.insurance enable row level security;
alter table public.intake_events enable row level security;
alter table public.job_dispatch_deliveries enable row level security;
alter table public.journey_checkpoint_events enable row level security;
alter table public.journey_checkpoints enable row level security;
alter table public.lead_followups enable row level security;
alter table public.leadnet_config enable row level security;
alter table public.lto_agreements enable row level security;
alter table public.maintenance_appointments enable row level security;
alter table public.marketing_kpi_weeks enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.memory_entities enable row level security;
alter table public.memory_events enable row level security;
alter table public.memory_facts enable row level security;
alter table public.mesh_nodes enable row level security;
alter table public.mission_items enable row level security;
alter table public.money_meter_accounts enable row level security;
alter table public.money_meter_events enable row level security;
alter table public.operation_costs enable row level security;
alter table public.operator_pipeline_tracker enable row level security;
alter table public.operator_profiles enable row level security;
alter table public.operator_rubric_scores enable row level security;
alter table public.operator_training_modules enable row level security;
alter table public.operator_training_progress enable row level security;
alter table public.operator_va_assignments enable row level security;
alter table public.org_responder_links enable row level security;
alter table public.org_roles enable row level security;
alter table public.organization_domains enable row level security;
alter table public.organization_licenses enable row level security;
alter table public.organizations enable row level security;
alter table public.outreach_touches enable row level security;
alter table public.package_entitlements enable row level security;
alter table public.packages enable row level security;
alter table public.parties enable row level security;
alter table public.partner_app_endpoints enable row level security;
alter table public.partner_fleet_access enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partners enable row level security;
alter table public.payments enable row level security;
alter table public.people enable row level security;
alter table public.portal_clients enable row level security;
alter table public.profile_entitlement_grants enable row level security;
alter table public.profiles enable row level security;
alter table public.program_applications enable row level security;
alter table public.program_audit_log enable row level security;
alter table public.program_documents enable row level security;
alter table public.programs enable row level security;
alter table public.protocol_runs enable row level security;
alter table public.rental_insurance_products enable row level security;
alter table public.rental_insurance_selections enable row level security;
alter table public.rental_ledger enable row level security;
alter table public.rental_pricing_rules enable row level security;
alter table public.revenue_splits enable row level security;
alter table public.rewards enable row level security;
alter table public.routing_candidates enable row level security;
alter table public.services enable row level security;
alter table public.shops_mechanics_cleaning enable row level security;
alter table public.signup_invites enable row level security;
alter table public.sync_events enable row level security;
alter table public.tasks enable row level security;
alter table public.team_onboarding enable row level security;
alter table public.tickets enable row level security;
alter table public.time_clock_entries enable row level security;
alter table public.tmmt_token_balances enable row level security;
alter table public.tmmt_token_events enable row level security;
alter table public.tmmt_token_ledger enable row level security;
alter table public.training_module_progress enable row level security;
alter table public.training_modules enable row level security;
alter table public.unit_locations enable row level security;
alter table public.units enable row level security;
alter table public.vehicle_damage_reports enable row level security;
alter table public.vehicle_events enable row level security;
alter table public.vehicle_handover enable row level security;
alter table public.vehicle_media enable row level security;
alter table public.vehicle_onboarding_inspections enable row level security;
alter table public.vehicles enable row level security;
alter table public.vendor_files enable row level security;
alter table public.vendor_job_updates enable row level security;
alter table public.vendor_jobs enable row level security;
alter table public.vendors enable row level security;
alter table public.ventures enable row level security;
alter table public.verticals enable row level security;
alter table public.waitlist enable row level security;
alter table public.work_assignments enable row level security;

-- ============ 11. POLICIES (338) ============
create policy active_customers_org_all on public.active_customers as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy aff_links_self on public.affiliate_links as permissive for select to authenticated
  using ((operator_id IN ( SELECT operator_profiles.id
   FROM operator_profiles
  WHERE (operator_profiles.profile_id = auth.uid()))));

create policy service_role_all on public.agent_conversations as permissive for all to service_role
  using (true)
  with check (true);

create policy agent_definitions_admin on public.agent_definitions as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy agent_evaluation_sessions_org_all on public.agent_evaluation_sessions as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy agent_sessions_staff on public.agent_evaluation_sessions as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.agent_evaluation_sessions as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.agent_evaluation_sessions as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy agent_evaluations_org_all on public.agent_evaluations as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy agent_votes_staff on public.agent_evaluations as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.agent_evaluations as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.agent_evaluations as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy agent_jobs_admin on public.agent_jobs as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy service_role_all on public.agent_messages as permissive for all to service_role
  using (true)
  with check (true);

create policy anon_insert_appointments on public.appointments as permissive for insert to anon
  with check (true);

create policy appointments_org_all on public.appointments as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy dispatcher_write on public.assignment_overrides as permissive for all to public
  using ((is_org_dispatcher(org_id) OR is_staff()))
  with check ((is_org_dispatcher(org_id) OR is_staff()));

create policy tenant_read on public.assignment_overrides as permissive for select to public
  using ((is_org_member(org_id) OR is_staff()));

create policy service_role_all on public.audit_events as permissive for all to service_role
  using (true)
  with check (true);

create policy automation_outbox_admin on public.automation_outbox as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy anon_insert_bg_checks on public.background_checks as permissive for insert to anon
  with check (true);

create policy background_checks_admin_only on public.background_checks as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy bills_delete on public.bills as permissive for delete to public
  using ((is_staff() OR (owner_id = auth.uid())));

create policy bills_insert on public.bills as permissive for insert to public
  with check (((owner_id = auth.uid()) AND ((org_id IS NULL) OR is_org_member(org_id))));

create policy bills_select on public.bills as permissive for select to public
  using ((is_staff() OR (owner_id = auth.uid()) OR ((org_id IS NOT NULL) AND (scope <> ALL (ARRAY['Personal'::text, 'Family'::text])) AND is_org_member(org_id))));

create policy bills_update on public.bills as permissive for update to public
  using ((is_staff() OR (owner_id = auth.uid()) OR ((org_id IS NOT NULL) AND (scope <> ALL (ARRAY['Personal'::text, 'Family'::text])) AND is_org_member(org_id))))
  with check ((is_staff() OR (owner_id = auth.uid()) OR ((org_id IS NOT NULL) AND (scope <> ALL (ARRAY['Personal'::text, 'Family'::text])) AND is_org_member(org_id))));

create policy bookings_email_read on public.bookings as permissive for select to public
  using (((profile_id = ( SELECT auth.uid() AS uid)) OR ((customer_email IS NOT NULL) AND (lower(customer_email) = lower(current_profile_email())))));

create policy bookings_org_all on public.bookings as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy bookings_self_read on public.bookings as permissive for select to public
  using ((profile_id = auth.uid()));

create policy bookings_staff_all on public.bookings as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy case_client_updates_client_read on public.case_client_updates as permissive for select to public
  using ((lower(customer_email) = lower(current_profile_email())));

create policy case_client_updates_org_all on public.case_client_updates as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy case_client_updates_staff on public.case_client_updates as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy case_status_history_org_all on public.case_status_history as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy csh_client_read on public.case_status_history as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM cases c
  WHERE ((c.id = case_status_history.case_id) AND (c.customer_email IS NOT NULL) AND (lower(c.customer_email) = lower(current_profile_email()))))));

create policy csh_staff on public.case_status_history as permissive for select to public
  using (is_staff());

create policy cases_client_email_read on public.cases as permissive for select to public
  using (((customer_email IS NOT NULL) AND (lower(customer_email) = lower(( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));

create policy cases_client_insert on public.cases as permissive for insert to public
  with check (((customer_email IS NOT NULL) AND (lower(customer_email) = lower(( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));

create policy cases_internal_read on public.cases as permissive for select to authenticated
  using (is_internal_ops());

create policy cases_internal_update on public.cases as permissive for update to authenticated
  using (is_internal_ops())
  with check (is_internal_ops());

create policy clickup_tasks_org_all on public.clickup_tasks as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy clickup_tasks_staff_all on public.clickup_tasks as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy client_alerts_client_ack on public.client_alerts as permissive for update to public
  using ((lower(customer_email) = lower(current_profile_email())))
  with check ((lower(customer_email) = lower(current_profile_email())));

create policy client_alerts_client_read on public.client_alerts as permissive for select to public
  using ((lower(customer_email) = lower(current_profile_email())));

create policy client_alerts_org_all on public.client_alerts as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy client_alerts_staff on public.client_alerts as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy client_journey_client_insert on public.client_journey as permissive for insert to public
  with check ((lower(customer_email) = lower(current_profile_email())));

create policy client_journey_client_read on public.client_journey as permissive for select to public
  using ((lower(customer_email) = lower(current_profile_email())));

create policy client_journey_org_all on public.client_journey as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy client_journey_staff on public.client_journey as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy "client sees own updates" on public.client_updates as permissive for select to public
  using ((client_email = (auth.jwt() ->> 'email'::text)));

create policy "partner sees referred updates" on public.client_updates as permissive for select to public
  using ((partner_slug IN ( SELECT partners.slug
   FROM partners
  WHERE (partners.email = (auth.jwt() ->> 'email'::text)))));

create policy "service role full access updates" on public.client_updates as permissive for all to public
  using ((auth.role() = 'service_role'::text));

create policy staff_all_comm_channels on public.comm_channels as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy contract_instances_client on public.contract_instances as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM client_journey j
  WHERE ((j.id = contract_instances.journey_id) AND (lower(j.customer_email) = lower(current_profile_email()))))));

create policy contract_instances_org_all on public.contract_instances as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy contract_instances_staff on public.contract_instances as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy contracts_org_all on public.contracts as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy coo_briefings_org_all on public.coo_briefings as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy coo_briefings_staff on public.coo_briefings as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.coo_briefings as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.coo_briefings as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy counselor_esc_org_read on public.counselor_escalation_state as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy counselor_inter_org_read on public.counselor_interaction as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy counselor_profile_org_read on public.counselor_profile as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy counselor_snap_org_read on public.counselor_profile_snapshot as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy counselor_resist_org_read on public.counselor_resistance_event as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy counselor_sess_org_read on public.counselor_session as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy credit_billing_plans_client_self_read on public.credit_billing_plans as permissive for select to public
  using ((enrollment_id IN ( SELECT credit_enrollments.id
   FROM credit_enrollments
  WHERE (credit_enrollments.customer_email = auth.email()))));

create policy credit_billing_plans_org_all on public.credit_billing_plans as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy credit_plans_client on public.credit_billing_plans as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM client_journey j
  WHERE ((j.id = credit_billing_plans.journey_id) AND (lower(j.customer_email) = lower(current_profile_email()))))));

create policy credit_plans_staff on public.credit_billing_plans as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy credit_ack_own on public.credit_education_acknowledgments as permissive for all to public
  using (((profile_id = auth.uid()) AND org_has_module('credit_repair'::text)))
  with check (((profile_id = auth.uid()) AND org_has_module('credit_repair'::text)));

create policy credit_ack_staff on public.credit_education_acknowledgments as permissive for select to public
  using (is_staff());

create policy credit_education_acknowledgments_org_all on public.credit_education_acknowledgments as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy credit_edu_sections_read on public.credit_education_sections as permissive for select to public
  using ((active = true));

create policy credit_enroll_client on public.credit_enrollments as permissive for select to public
  using (((lower(customer_email) = lower(current_profile_email())) AND org_has_module('credit_repair'::text)));

create policy credit_enroll_staff on public.credit_enrollments as permissive for all to public
  using ((is_staff() AND org_has_module('credit_repair'::text)))
  with check ((is_staff() AND org_has_module('credit_repair'::text)));

create policy credit_enrollments_org_all on public.credit_enrollments as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy anon_insert_credit_funding on public.credit_funding_sessions as permissive for insert to anon
  with check (true);

create policy cfs_delete_internal on public.credit_funding_sessions as permissive for delete to authenticated
  using (is_internal_ops());

create policy cfs_select_staff on public.credit_funding_sessions as permissive for select to authenticated
  using ((is_staff() OR is_internal_ops()));

create policy cfs_update_staff on public.credit_funding_sessions as permissive for update to authenticated
  using ((is_staff() OR is_internal_ops()))
  with check ((is_staff() OR is_internal_ops()));

create policy credit_funding_sessions_org_all on public.credit_funding_sessions as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy org_member_read on public.credit_funding_sessions as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.credit_funding_sessions as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy cps_delete_internal on public.credit_payment_schedule as permissive for delete to authenticated
  using (is_internal_ops());

create policy cps_insert_staff on public.credit_payment_schedule as permissive for insert to authenticated
  with check ((is_staff() OR is_internal_ops()));

create policy cps_select_staff on public.credit_payment_schedule as permissive for select to authenticated
  using ((is_staff() OR is_internal_ops()));

create policy cps_update_staff on public.credit_payment_schedule as permissive for update to authenticated
  using ((is_staff() OR is_internal_ops()))
  with check ((is_staff() OR is_internal_ops()));

create policy credit_payment_schedule_client_self_read on public.credit_payment_schedule as permissive for select to public
  using ((plan_id IN ( SELECT cbp.id
   FROM (credit_billing_plans cbp
     JOIN credit_enrollments ce ON ((ce.id = cbp.enrollment_id)))
  WHERE (ce.customer_email = auth.email()))));

create policy credit_payment_schedule_org_all on public.credit_payment_schedule as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy credit_catalog_read on public.credit_product_catalog as permissive for select to public
  using ((active = true));

create policy crm_sync_internal_read on public.crm_sync_records as permissive for select to authenticated
  using (is_internal_ops());

create policy crm_sync_internal_update on public.crm_sync_records as permissive for update to authenticated
  using (is_internal_ops())
  with check (is_internal_ops());

create policy anon_insert_inspections on public.customer_inspection_photos as permissive for insert to anon
  with check (true);

create policy customer_inspection_photos_org_all on public.customer_inspection_photos as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy intake_internal_read on public.customer_intake_forms as permissive for select to public
  using (is_internal_ops());

create policy intake_public_insert on public.customer_intake_forms as permissive for insert to public
  with check (true);

create policy customer_payments_admin_only on public.customer_payments as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy org_read_customer_services on public.customer_services as permissive for select to authenticated
  using (is_org_member(org_id));

create policy staff_all_customer_services on public.customer_services as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy customer_vehicles_org_all on public.customer_vehicles as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy staff_all_customer_vehicles on public.customer_vehicles as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy deal_payments_org_all on public.deal_payments as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy deal_payments_staff on public.deal_payments as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy anon_insert_dealer_applications on public.dealer_applications as permissive for insert to anon
  with check ((((length(COALESCE(dealership_name, ''::text)) >= 1) AND (length(COALESCE(dealership_name, ''::text)) <= 200)) AND ((length(COALESCE(owner_name, ''::text)) >= 1) AND (length(COALESCE(owner_name, ''::text)) <= 120)) AND ((length(COALESCE(phone, ''::text)) >= 7) AND (length(COALESCE(phone, ''::text)) <= 40)) AND (length(COALESCE(email, ''::text)) <= 200) AND (length(COALESCE(city_state, ''::text)) <= 120) AND (length(COALESCE(license_number, ''::text)) <= 60) AND (length(COALESCE(years_in_business, ''::text)) <= 40) AND (length(COALESCE(units_on_lot, ''::text)) <= 40) AND (length(COALESCE(biggest_struggle, ''::text)) <= 2000) AND (length(COALESCE(interested_tier, ''::text)) <= 60) AND (length(COALESCE(device, ''::text)) <= 120) AND (length(COALESCE(source, ''::text)) <= 120) AND (status = 'new'::text) AND (qualifies = false)));

create policy staff_all_dealer_applications on public.dealer_applications as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy deals_org_all on public.deals as permissive for all to authenticated
  using ((is_staff() OR ((organization_id IS NOT NULL) AND is_org_member(organization_id))))
  with check ((is_staff() OR ((organization_id IS NOT NULL) AND is_org_member(organization_id))));

create policy deals_staff on public.deals as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy detail_jobs_org_all on public.detail_jobs as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy staff_all_detail_jobs on public.detail_jobs as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy detail_memberships_org_all on public.detail_memberships as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy staff_all_detail_memberships on public.detail_memberships as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy dispute_clients_admin_only on public.dispute_clients as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy dnc_read_authenticated on public.do_not_contact_numbers as permissive for select to authenticated
  using (true);

create policy do_not_rent_list_org_all on public.do_not_rent_list as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy documents_admin_only on public.documents as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy employee_access_rights_admin_manager_delete on public.employee_access_rights as permissive for delete to authenticated
  using ((is_admin() OR is_manager()));

create policy employee_access_rights_admin_manager_insert on public.employee_access_rights as permissive for insert to authenticated
  with check ((is_admin() OR is_manager()));

create policy employee_access_rights_admin_manager_select on public.employee_access_rights as permissive for select to authenticated
  using ((is_admin() OR is_manager()));

create policy employee_access_rights_admin_manager_update on public.employee_access_rights as permissive for update to authenticated
  using ((is_admin() OR is_manager()))
  with check ((is_admin() OR is_manager()));

create policy employee_access_rights_employee_self_select on public.employee_access_rights as permissive for select to authenticated
  using (((employee_email IS NOT NULL) AND (lower(employee_email) = lower(( SELECT p.email
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))))));

create policy employee_access_rights_internal_team_self_select on public.employee_access_rights as permissive for select to authenticated
  using (((employee_email IS NOT NULL) AND (lower(employee_email) = lower(( SELECT p.email
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM profiles p2
  WHERE ((p2.id = ( SELECT auth.uid() AS uid)) AND (p2.role = 'internal_team'::user_role))))));

create policy enforcement_settings_staff_all on public.enforcement_settings as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy entitlements_read on public.entitlements as permissive for select to public
  using (true);

create policy service_role_all on public.exec_va_tasks as permissive for all to service_role
  using (true);

create policy expenses_org_all on public.expenses as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy fleet_org_all on public.fleet as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy fleet_car_inspections_org_all on public.fleet_car_inspections as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy form_submissions_staff_read on public.form_submissions as permissive for select to authenticated
  using (is_staff());

create policy former_customers_org_all on public.former_customers as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy garage_builds_public_read on public.garage_builds as permissive for select to public
  using (true);

create policy garage_gates_public_read on public.garage_gates as permissive for select to public
  using (true);

create policy garage_history_public_read on public.garage_history as permissive for select to public
  using (true);

create policy garage_ledger_public_read on public.garage_ledger as permissive for select to public
  using (true);

create policy garage_mods_public_read on public.garage_mods as permissive for select to public
  using (true);

create policy ghl_appointments_org_read on public.ghl_appointments as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy ghl_contacts_org_read on public.ghl_contacts as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy ghl_form_submissions_org_read on public.ghl_form_submissions as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy no_public_access on public.hailmary_licenses as permissive for all to public
  using (false);

create policy dispatcher_write on public.incident_assignments as permissive for all to public
  using ((is_org_dispatcher(org_id) OR is_staff()))
  with check ((is_org_dispatcher(org_id) OR is_staff()));

create policy responder_self_assignment on public.incident_assignments as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM units u
  WHERE ((u.id = incident_assignments.unit_id) AND (u.responder_id = auth.uid())))));

create policy tenant_read on public.incident_assignments as permissive for select to public
  using ((is_org_member(org_id) OR is_staff()));

create policy dispatcher_write on public.incidents as permissive for all to public
  using ((is_org_dispatcher(org_id) OR is_staff()))
  with check ((is_org_dispatcher(org_id) OR is_staff()));

create policy responder_parent_incident on public.incidents as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (incident_assignments ia
     JOIN units u ON ((u.id = ia.unit_id)))
  WHERE ((ia.incident_id = incidents.id) AND (u.responder_id = auth.uid())))));

create policy tenant_read on public.incidents as permissive for select to public
  using ((is_org_member(org_id) OR is_staff()));

create policy anon_insert_leads on public.incoming_leads as permissive for insert to anon
  with check (((length(COALESCE(contact_name, ''::text)) <= 120) AND (length(COALESCE(opportunity_name, ''::text)) <= 200) AND (length(COALESCE(email, ''::text)) <= 200) AND (length(COALESCE(phone_text, ''::text)) <= 40) AND (length(COALESCE(notes, ''::text)) <= 4000) AND (length(COALESCE(source, ''::text)) <= 120) AND (length(COALESCE(source_campaign, ''::text)) <= 200) AND (length(COALESCE(referrer_url, ''::text)) <= 500) AND (length(COALESCE(landing_url, ''::text)) <= 500) AND (length(COALESCE(utm_source, ''::text)) <= 120) AND (length(COALESCE(utm_medium, ''::text)) <= 120) AND (length(COALESCE(utm_campaign, ''::text)) <= 200) AND (length(COALESCE(affiliate_code, ''::text)) <= 60) AND (affiliate_operator_id IS NULL) AND (assigned_to IS NULL) AND (assigned_at IS NULL) AND (stripe_payment_intent_id IS NULL) AND (sku_price_cents IS NULL) AND (conversation_id IS NULL) AND (referred_by_lead_id IS NULL) AND (contacted_at IS NULL) AND (qualified_at IS NULL) AND (closed_at IS NULL) AND (lost_at IS NULL) AND (opted_out = false)));

create policy incoming_leads_org_all on public.incoming_leads as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy staff_all_installations on public.installations as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy insurance_admin_only on public.insurance as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy intake_events_admin on public.intake_events as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy job_dispatch_deliveries_internal on public.job_dispatch_deliveries as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::user_role, 'internal_team'::user_role]))))));

create policy journey_checkpoint_events_org_all on public.journey_checkpoint_events as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy journey_events_client_read on public.journey_checkpoint_events as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM client_journey j
  WHERE ((j.id = journey_checkpoint_events.journey_id) AND (lower(j.customer_email) = lower(current_profile_email()))))));

create policy journey_events_staff on public.journey_checkpoint_events as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy journey_checkpoints_org_read on public.journey_checkpoints as permissive for select to public
  using ((is_staff() OR is_org_member(organization_id)));

create policy staff_all_lead_followups on public.lead_followups as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy staff_all_leadnet_config on public.leadnet_config as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy lto_agreements_org_all on public.lto_agreements as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy lto_client on public.lto_agreements as permissive for select to public
  using (((EXISTS ( SELECT 1
   FROM client_journey j
  WHERE ((j.id = lto_agreements.journey_id) AND (lower(j.customer_email) = lower(current_profile_email()))))) AND org_has_module('lease_to_own'::text)));

create policy lto_staff on public.lto_agreements as permissive for all to public
  using ((is_staff() AND org_has_module('lease_to_own'::text)))
  with check ((is_staff() AND org_has_module('lease_to_own'::text)));

create policy maintenance_appointments_org_all on public.maintenance_appointments as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy marketing_kpi_staff on public.marketing_kpi_weeks as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy marketing_kpi_weeks_org_all on public.marketing_kpi_weeks as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy org_member_read on public.marketing_kpi_weeks as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.marketing_kpi_weeks as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy marketplace_listings_anon_browse on public.marketplace_listings as permissive for select to anon
  using ((active = true));

create policy marketplace_listings_org_all on public.marketplace_listings as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy marketplace_listings_staff on public.marketplace_listings as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.marketplace_listings as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.marketplace_listings as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy org_read_memory_entities on public.memory_entities as permissive for select to authenticated
  using (is_org_member(org_id));

create policy staff_all_memory_entities on public.memory_entities as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy org_read_memory_events on public.memory_events as permissive for select to authenticated
  using (is_org_member(org_id));

create policy staff_all_memory_events on public.memory_events as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy org_read_memory_facts on public.memory_facts as permissive for select to authenticated
  using ((is_org_member(org_id) AND (visibility = 'org'::text)));

create policy staff_read_org_memory_facts on public.memory_facts as permissive for select to authenticated
  using ((is_staff() AND ((visibility = 'org'::text) OR is_owner())));

create policy staff_update_memory_facts on public.memory_facts as permissive for update to authenticated
  using ((is_staff() AND ((visibility = 'org'::text) OR is_owner())))
  with check ((is_staff() AND ((visibility = 'org'::text) OR is_owner())));

create policy staff_write_memory_facts on public.memory_facts as permissive for insert to authenticated
  with check ((is_staff() AND ((visibility = 'org'::text) OR is_owner())));

create policy "operator read own" on public.mesh_nodes as permissive for select to public
  using (((operator = (auth.jwt() ->> 'email'::text)) OR ((auth.jwt() ->> 'email'::text) = 'aixmos@icloud.com'::text)));

create policy "owner full access" on public.mesh_nodes as permissive for all to public
  using (((auth.jwt() ->> 'email'::text) = 'aixmos@icloud.com'::text));

create policy mission_items_read on public.mission_items as permissive for select to authenticated
  using (((status = 'published'::text) AND ((profile_id = auth.uid()) OR (profile_id IS NULL))));

create policy money_meter_accounts_read_own on public.money_meter_accounts as permissive for select to public
  using ((is_staff() OR is_org_member(org_id)));

create policy money_meter_events_read_own on public.money_meter_events as permissive for select to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy operation_costs_org_all on public.operation_costs as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy operator_pipeline_tracker_org_all on public.operator_pipeline_tracker as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy operator_pipeline_tracker_staff_insert on public.operator_pipeline_tracker as permissive for insert to authenticated
  with check (is_staff());

create policy operator_pipeline_tracker_staff_select on public.operator_pipeline_tracker as permissive for select to authenticated
  using (is_staff());

create policy operator_profiles_client on public.operator_profiles as permissive for select to public
  using ((lower(customer_email) = lower(current_profile_email())));

create policy operator_profiles_org_all on public.operator_profiles as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy operator_profiles_staff on public.operator_profiles as permissive for all to public
  using ((is_staff() AND org_has_module('operator_program'::text)))
  with check ((is_staff() AND org_has_module('operator_program'::text)));

create policy operator_rubric_scores_org_all on public.operator_rubric_scores as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy operator_rubric_staff on public.operator_rubric_scores as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.operator_rubric_scores as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.operator_rubric_scores as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy operator_training_modules_read on public.operator_training_modules as permissive for select to authenticated
  using ((active = true));

create policy operator_training_progress_rw on public.operator_training_progress as permissive for all to authenticated
  using (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM org_roles r
  WHERE (r.user_id = auth.uid())))))
  with check (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM org_roles r
  WHERE (r.user_id = auth.uid())))));

create policy operator_va_assignments_staff_all on public.operator_va_assignments as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy dispatcher_write on public.org_responder_links as permissive for all to public
  using ((is_org_dispatcher(org_id) OR is_staff()))
  with check ((is_org_dispatcher(org_id) OR is_staff()));

create policy tenant_read on public.org_responder_links as permissive for select to public
  using ((is_org_member(org_id) OR is_staff()));

create policy self_read on public.org_roles as permissive for select to public
  using (((user_id = auth.uid()) OR is_staff()));

create policy tenant_admin_write on public.org_roles as permissive for all to public
  using ((is_staff() OR (EXISTS ( SELECT 1
   FROM org_roles r
  WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text))))))
  with check ((is_staff() OR (EXISTS ( SELECT 1
   FROM org_roles r
  WHERE ((r.org_id = org_roles.org_id) AND (r.user_id = auth.uid()) AND (r.role = 'tenant_admin'::text))))));

create policy organization_domains_org_all on public.organization_domains as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy org_licenses_admin_write on public.organization_licenses as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy org_licenses_staff_read on public.organization_licenses as permissive for select to public
  using (is_staff());

create policy organizations_select on public.organizations as permissive for select to authenticated
  using (((id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'internal_team'::user_role])))))));

create policy package_entitlements_read on public.package_entitlements as permissive for select to public
  using (true);

create policy packages_read on public.packages as permissive for select to public
  using (true);

create policy parties_org_all on public.parties as permissive for all to authenticated
  using ((is_staff() OR ((organization_id IS NOT NULL) AND is_org_member(organization_id))))
  with check ((is_staff() OR ((organization_id IS NOT NULL) AND is_org_member(organization_id))));

create policy parties_staff on public.parties as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy partner_app_endpoints_internal on public.partner_app_endpoints as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::user_role, 'internal_team'::user_role]))))));

create policy partner_fleet_access_org_all on public.partner_fleet_access as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy staff_all_partner_fleet_access on public.partner_fleet_access as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.partner_referrals as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.partner_referrals as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy partner_referrals_org_all on public.partner_referrals as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy "partner sees own row" on public.partners as permissive for select to public
  using ((email = (auth.jwt() ->> 'email'::text)));

create policy "service role full access partners" on public.partners as permissive for all to public
  using ((auth.role() = 'service_role'::text));

create policy payments_client_read on public.payments as permissive for select to public
  using (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = payments.booking_id) AND (b.customer_email IS NOT NULL) AND (lower(b.customer_email) = lower(current_profile_email())))))));

create policy payments_org_all on public.payments as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy payments_staff on public.payments as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy people_staff_read on public.people as permissive for select to authenticated
  using (is_staff());

create policy people_staff_write on public.people as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy "clients see own row" on public.portal_clients as permissive for select to public
  using ((email = (auth.jwt() ->> 'email'::text)));

create policy "partner sees referred clients" on public.portal_clients as permissive for select to public
  using ((partner_slug IN ( SELECT partners.slug
   FROM partners
  WHERE (partners.email = (auth.jwt() ->> 'email'::text)))));

create policy "service role full access" on public.portal_clients as permissive for all to public
  using ((auth.role() = 'service_role'::text));

create policy grants_admin_write on public.profile_entitlement_grants as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy grants_self_read on public.profile_entitlement_grants as permissive for select to public
  using (((profile_id = ( SELECT auth.uid() AS uid)) OR is_admin()));

create policy profiles_admin_all on public.profiles as permissive for all to public
  using (is_admin())
  with check (is_admin());

create policy profiles_self_read on public.profiles as permissive for select to public
  using (((id = ( SELECT auth.uid() AS uid)) OR is_staff() OR is_admin()));

create policy profiles_self_update on public.profiles as permissive for update to public
  using (((id = ( SELECT auth.uid() AS uid)) OR is_admin()))
  with check (((id = ( SELECT auth.uid() AS uid)) OR is_admin()));

create policy prog_apps_delete_internal on public.program_applications as permissive for delete to authenticated
  using (is_internal_ops());

create policy prog_apps_insert_staff on public.program_applications as permissive for insert to authenticated
  with check ((is_staff() OR is_internal_ops()));

create policy prog_apps_select_staff on public.program_applications as permissive for select to authenticated
  using ((is_staff() OR is_internal_ops()));

create policy prog_apps_update_staff on public.program_applications as permissive for update to authenticated
  using ((is_staff() OR is_internal_ops()))
  with check ((is_staff() OR is_internal_ops()));

create policy program_applications_org_all on public.program_applications as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy prog_audit_select_internal on public.program_audit_log as permissive for select to authenticated
  using ((is_internal_ops() OR is_admin()));

create policy program_documents_own on public.program_documents as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM program_applications a
  WHERE ((a.id = program_documents.application_id) AND (lower(a.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy program_documents_staff on public.program_documents as permissive for all to authenticated
  using ((is_staff() OR is_platform_admin()))
  with check ((is_staff() OR is_platform_admin()));

create policy programs_admin on public.programs as permissive for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy protocol_runs_internal on public.protocol_runs as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::user_role, 'internal_team'::user_role]))))));

create policy insurance_products_public_read on public.rental_insurance_products as permissive for select to anon, authenticated
  using ((active = true));

create policy insurance_selections_client_read on public.rental_insurance_selections as permissive for select to authenticated
  using ((lower(customer_email) = lower(current_profile_email())));

create policy insurance_selections_staff_all on public.rental_insurance_selections as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.rental_insurance_selections as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.rental_insurance_selections as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy rental_insurance_selections_org_all on public.rental_insurance_selections as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy rental_ledger_client_read on public.rental_ledger as permissive for select to public
  using (((lower(customer_email) = lower(current_profile_email())) AND (COALESCE(visible_to_client, true) = true)));

create policy rental_ledger_investor_insert on public.rental_ledger as permissive for insert to public
  with check (("current_role"() = ANY (ARRAY['investor'::user_role, 'admin'::user_role])));

create policy rental_ledger_investor_read on public.rental_ledger as permissive for select to public
  using ((("current_role"() = 'investor'::user_role) OR is_admin()));

create policy rental_ledger_investor_update on public.rental_ledger as permissive for update to public
  using (("current_role"() = ANY (ARRAY['investor'::user_role, 'admin'::user_role])))
  with check (("current_role"() = ANY (ARRAY['investor'::user_role, 'admin'::user_role])));

create policy rental_ledger_staff on public.rental_ledger as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.rental_pricing_rules as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.rental_pricing_rules as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy pricing_rules_anon_browse on public.rental_pricing_rules as permissive for select to anon
  using ((active = true));

create policy pricing_rules_org_all on public.rental_pricing_rules as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy revenue_splits_operator_self_read on public.revenue_splits as permissive for select to public
  using ((operator_id IN ( SELECT operator_profiles.id
   FROM operator_profiles
  WHERE (operator_profiles.profile_id = auth.uid()))));

create policy revenue_splits_staff on public.revenue_splits as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.rewards as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.rewards as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy rewards_org_all on public.rewards as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy rewards_self on public.rewards as permissive for select to public
  using ((profile_id = auth.uid()));

create policy rewards_staff on public.rewards as permissive for select to public
  using (is_staff());

create policy org_read_routing_candidates on public.routing_candidates as permissive for select to authenticated
  using (is_org_member(org_id));

create policy staff_all_routing_candidates on public.routing_candidates as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.services as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.services as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy services_anon_browse on public.services as permissive for select to anon
  using ((active = true));

create policy services_org_all on public.services as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy services_staff_write on public.services as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy shops_mechanics_cleaning_org_all on public.shops_mechanics_cleaning as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy sync_events_internal_read on public.sync_events as permissive for select to authenticated
  using (is_internal_ops());

create policy tasks_org_all on public.tasks as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy anon_insert_team_onboarding on public.team_onboarding as permissive for insert to anon
  with check (true);

create policy staff_all_team_onboarding on public.team_onboarding as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy anon_insert_tickets on public.tickets as permissive for insert to anon
  with check (true);

create policy tickets_org_all on public.tickets as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy tce_self_insert on public.time_clock_entries as permissive for insert to authenticated
  with check ((user_id = auth.uid()));

create policy tce_self_select on public.time_clock_entries as permissive for select to authenticated
  using ((user_id = auth.uid()));

create policy tce_self_update on public.time_clock_entries as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

create policy tce_staff_all on public.time_clock_entries as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy time_clock_entries_org_all on public.time_clock_entries as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy tmmt_balances_read_own on public.tmmt_token_balances as permissive for select to public
  using ((is_staff() OR is_org_member(org_id)));

create policy tmmt_events_read_own on public.tmmt_token_events as permissive for select to public
  using ((is_staff() OR is_org_member(org_id)));

create policy training_module_progress_org_all on public.training_module_progress as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy training_progress_own on public.training_module_progress as permissive for all to public
  using ((profile_id = auth.uid()))
  with check ((profile_id = auth.uid()));

create policy training_progress_staff on public.training_module_progress as permissive for select to public
  using (is_staff());

create policy training_modules_read on public.training_modules as permissive for select to public
  using ((active = true));

create policy dispatcher_write on public.unit_locations as permissive for all to public
  using ((is_org_dispatcher(org_id) OR is_staff()))
  with check ((is_org_dispatcher(org_id) OR is_staff()));

create policy tenant_read on public.unit_locations as permissive for select to public
  using ((is_org_member(org_id) OR is_staff()));

create policy dispatcher_write on public.units as permissive for all to public
  using ((is_org_dispatcher(org_id) OR is_staff()))
  with check ((is_org_dispatcher(org_id) OR is_staff()));

create policy tenant_read on public.units as permissive for select to public
  using ((is_org_member(org_id) OR is_staff()));

create policy org_member_read on public.vehicle_damage_reports as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.vehicle_damage_reports as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicle_damage_client_read on public.vehicle_damage_reports as permissive for select to public
  using (((visible_to_client = true) AND (lower(customer_email) = lower(current_profile_email()))));

create policy vehicle_damage_reports_org_all on public.vehicle_damage_reports as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicle_damage_staff on public.vehicle_damage_reports as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy org_member_read on public.vehicle_events as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.vehicle_events as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicle_events_client on public.vehicle_events as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM client_journey j
  WHERE ((j.id = vehicle_events.journey_id) AND (lower(j.customer_email) = lower(current_profile_email()))))));

create policy vehicle_events_org_all on public.vehicle_events as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicle_events_staff on public.vehicle_events as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy anon_insert_handovers on public.vehicle_handover as permissive for insert to anon
  with check (true);

create policy vehicle_handover_org_all on public.vehicle_handover as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy org_member_read on public.vehicle_media as permissive for select to authenticated
  using ((is_staff() OR is_org_member(org_id)));

create policy org_member_write on public.vehicle_media as permissive for all to authenticated
  using ((is_staff() OR is_org_member(org_id)))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicle_media_client_read on public.vehicle_media as permissive for select to public
  using (((visible_to_client = true) AND (lower(customer_email) = lower(current_profile_email()))));

create policy vehicle_media_org_all on public.vehicle_media as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicle_media_staff on public.vehicle_media as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy anon_insert_onboarding on public.vehicle_onboarding_inspections as permissive for insert to anon
  with check (true);

create policy staff_all_onboarding on public.vehicle_onboarding_inspections as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy vehicle_onboarding_inspections_org_all on public.vehicle_onboarding_inspections as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicles_anon_browse on public.vehicles as permissive for select to anon
  using ((active = true));

create policy vehicles_org_all on public.vehicles as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vehicles_staff_write on public.vehicles as permissive for all to public
  using (is_staff())
  with check (is_staff());

create policy staff_all_vendor_files on public.vendor_files as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy vendor_files_org_all on public.vendor_files as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vendor_select_own_files on public.vendor_files as permissive for select to authenticated
  using ((vendor_job_id IN ( SELECT vj.id
   FROM (vendor_jobs vj
     JOIN vendors v ON ((v.id = vj.vendor_id)))
  WHERE (v.auth_user_id = auth.uid()))));

create policy staff_all_vendor_job_updates on public.vendor_job_updates as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy vendor_job_updates_org_all on public.vendor_job_updates as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vendor_job_updates_vendor_write on public.vendor_job_updates as permissive for insert to public
  with check ((vendor_job_id IN ( SELECT vj.id
   FROM (vendor_jobs vj
     JOIN vendors v ON ((v.id = vj.vendor_id)))
  WHERE (v.auth_user_id = auth.uid()))));

create policy vendor_select_own_job_updates on public.vendor_job_updates as permissive for select to authenticated
  using ((vendor_job_id IN ( SELECT vj.id
   FROM (vendor_jobs vj
     JOIN vendors v ON ((v.id = vj.vendor_id)))
  WHERE (v.auth_user_id = auth.uid()))));

create policy staff_all_vendor_jobs on public.vendor_jobs as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy vendor_jobs_org_all on public.vendor_jobs as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy vendor_select_own_jobs on public.vendor_jobs as permissive for select to authenticated
  using ((vendor_id IN ( SELECT vendors.id
   FROM vendors
  WHERE (vendors.auth_user_id = auth.uid()))));

create policy vendors_select on public.vendors as permissive for select to authenticated
  using (((auth_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::user_role, 'internal_team'::user_role])))))));

create policy vendors_self_insert on public.vendors as permissive for insert to public
  with check ((auth.uid() IS NOT NULL));

create policy vendors_update_own on public.vendors as permissive for update to authenticated
  using ((auth_user_id = auth.uid()))
  with check ((auth_user_id = auth.uid()));

create policy staff_all_ventures on public.ventures as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy ventures_org_all on public.ventures as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

create policy org_read_verticals on public.verticals as permissive for select to authenticated
  using (is_org_member(org_id));

create policy staff_all_verticals on public.verticals as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy anon_insert_waitlist on public.waitlist as permissive for insert to anon
  with check (true);

create policy waitlist_org_all on public.waitlist as permissive for all to authenticated
  using ((is_platform_admin() OR is_org_member(org_id)))
  with check ((is_platform_admin() OR is_org_member(org_id)));

create policy org_read_work_assignments on public.work_assignments as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM cases c
  WHERE ((c.id = work_assignments.case_id) AND is_org_member(c.org_id)))));

create policy staff_all_work_assignments on public.work_assignments as permissive for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy work_assignments_org_all on public.work_assignments as permissive for all to public
  using ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))
  with check ((is_staff() OR ((org_id IS NOT NULL) AND is_org_member(org_id))));

-- ============ 12. GRANTS ============
-- Explicit ACLs only. 0 functions still carry the DEFAULT acl
-- (execute to PUBLIC) - those are what the security advisor flags.

-- table and view grants
grant delete, insert, maintain, references, select, trigger, truncate, update on public.active_customers to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.active_customers to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.active_customers to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.affiliate_links to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.affiliate_links to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.affiliate_links to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_conversations to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_conversations to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_conversations to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_definitions to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_definitions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_definitions to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_evaluation_sessions to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_evaluation_sessions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_evaluation_sessions to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_evaluations to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_evaluations to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_evaluations to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_jobs to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_jobs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_jobs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_messages to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_messages to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.agent_messages to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.appointments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.appointments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.appointments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.assignment_overrides to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.assignment_overrides to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.assignment_overrides to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.audit_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.audit_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.audit_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.automation_outbox to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.automation_outbox to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.automation_outbox to service_role;
grant insert, maintain on public.background_checks to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.background_checks to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.background_checks to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.bills to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.bills to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.bills to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.bookings to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.bookings to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.bookings to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.case_client_updates to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.case_client_updates to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.case_client_updates to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.case_status_history to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.case_status_history to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.case_status_history to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.cases to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.cases to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.cases to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.clickup_tasks to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.clickup_tasks to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.clickup_tasks to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_alerts to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_alerts to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_alerts to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_journey to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_journey to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_journey to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_renter_status to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_renter_status to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_renter_status to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_updates to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_updates to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.client_updates to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.comm_channels to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.comm_channels to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.comm_channels to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.contract_instances to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.contract_instances to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.contract_instances to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.contracts to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.contracts to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.contracts to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.coo_briefings to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.coo_briefings to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.coo_briefings to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_escalation_state to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_escalation_state to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_escalation_state to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_interaction to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_interaction to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_interaction to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_profile to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_profile to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_profile to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_profile_snapshot to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_profile_snapshot to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_profile_snapshot to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_resistance_event to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_resistance_event to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_resistance_event to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_session to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_session to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.counselor_session to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_billing_plans to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_billing_plans to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_billing_plans to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_education_acknowledgments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_education_acknowledgments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_education_acknowledgments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_education_sections to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_education_sections to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_education_sections to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_enrollments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_enrollments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_enrollments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_funding_sessions to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_funding_sessions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_funding_sessions to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_payment_schedule to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_payment_schedule to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_payment_schedule to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_product_catalog to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_product_catalog to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.credit_product_catalog to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.crm_sync_records to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.crm_sync_records to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.crm_sync_records to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_inspection_photos to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_inspection_photos to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_inspection_photos to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_intake_forms to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_intake_forms to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_intake_forms to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_payments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_payments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_payments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_payments_snapshot_20260706 to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_payments_snapshot_20260706 to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_services to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_services to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_services to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_vehicles to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_vehicles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.customer_vehicles to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.deal_payments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.deal_payments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.deal_payments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.dealer_applications to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.dealer_applications to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.dealer_applications to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.deals to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.deals to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.deals to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.detail_jobs to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.detail_jobs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.detail_jobs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.detail_memberships to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.detail_memberships to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.detail_memberships to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.dispute_clients to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.dispute_clients to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.do_not_contact_numbers to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.do_not_contact_numbers to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.do_not_rent_list to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.do_not_rent_list to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.do_not_rent_list to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.documents to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.documents to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.documents to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.employee_access_rights to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.employee_access_rights to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.employee_access_rights to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.enforcement_settings to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.entitlements to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.entitlements to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.entitlements to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.exec_va_tasks to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.exec_va_tasks to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.exec_va_tasks to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.expenses to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.expenses to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.expenses to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.fleet to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.fleet to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.fleet to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.fleet_car_inspections to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.fleet_car_inspections to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.fleet_car_inspections to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.form_submissions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.form_submissions to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.former_customers to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.former_customers to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.former_customers to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_builds to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_builds to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_builds to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_gates to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_gates to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_gates to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_history to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_history to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_history to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_ledger to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_ledger to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_ledger to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_mods to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_mods to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.garage_mods to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_appointments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_appointments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_appointments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_contacts to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_contacts to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_contacts to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_form_submissions to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_form_submissions to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ghl_form_submissions to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.hailmary_licenses to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.hailmary_licenses to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.hailmary_licenses to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incident_assignments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incident_assignments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incident_assignments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incident_assignments_v to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incident_assignments_v to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incident_assignments_v to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incidents to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incidents to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incidents to service_role;
grant insert, maintain on public.incoming_leads to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incoming_leads to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.incoming_leads to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.installations to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.installations to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.installations to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.insurance to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.insurance to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.insurance to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.intake_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.intake_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.intake_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.job_dispatch_deliveries to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.job_dispatch_deliveries to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.job_dispatch_deliveries to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.journey_checkpoint_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.journey_checkpoint_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.journey_checkpoint_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.journey_checkpoints to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.journey_checkpoints to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.journey_checkpoints to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.lead_followups to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.lead_followups to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.lead_followups to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.leadnet_config to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.leadnet_config to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.leadnet_config to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.lto_agreements to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.lto_agreements to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.lto_agreements to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.maintenance_appointments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.maintenance_appointments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.maintenance_appointments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.marketing_kpi_weeks to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.marketing_kpi_weeks to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.marketing_kpi_weeks to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.marketplace_listings to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.marketplace_listings to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.marketplace_listings to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_entities to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_entities to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_entities to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_facts to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_facts to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.memory_facts to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.mesh_nodes to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.mesh_nodes to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.mesh_nodes to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.mission_items to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.mission_items to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.mission_items to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.money_meter_accounts to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.money_meter_accounts to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.money_meter_accounts to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.money_meter_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.money_meter_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.money_meter_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operation_costs to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operation_costs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operation_costs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_pipeline_tracker to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_pipeline_tracker to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_pipeline_tracker to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_profiles to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_profiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_profiles to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_rubric_scores to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_rubric_scores to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_rubric_scores to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_scoreboard to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_scoreboard to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_scoreboard to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_seats to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_seats to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_seats to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_training_modules to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_training_modules to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_training_modules to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_training_progress to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_training_progress to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_training_progress to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_va_assignments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_va_assignments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.operator_va_assignments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.org_responder_links to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.org_responder_links to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.org_responder_links to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.org_roles to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.org_roles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.org_roles to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organization_domains to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organization_domains to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organization_domains to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organization_licenses to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organization_licenses to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organization_licenses to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organizations to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organizations to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.organizations to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.outreach_touches to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.outreach_touches to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.outreach_touches to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.package_entitlements to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.package_entitlements to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.package_entitlements to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.packages to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.packages to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.packages to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.parties to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.parties to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.parties to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_app_endpoints to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_app_endpoints to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_app_endpoints to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_fleet_access to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_fleet_access to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_fleet_access to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_referrals to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_referrals to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partner_referrals to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partners to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partners to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.partners to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.payments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.payments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.payments to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.people to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.people to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.portal_clients to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.portal_clients to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.portal_clients to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.profile_entitlement_grants to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.profile_entitlement_grants to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.profile_entitlement_grants to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.profiles to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.profiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.profiles to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_applications to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_applications to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_applications to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_audit_log to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_audit_log to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_audit_log to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_documents to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.program_documents to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.programs to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.programs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.programs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.protocol_runs to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.protocol_runs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.protocol_runs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_insurance_products to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_insurance_products to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_insurance_products to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_insurance_selections to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_insurance_selections to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_insurance_selections to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_ledger to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_ledger to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_ledger to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_pricing_rules to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_pricing_rules to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rental_pricing_rules to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.renter_pipeline_status to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.renter_pipeline_status to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.renter_pipeline_status to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.revenue_splits to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.revenue_splits to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.revenue_splits to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rewards to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rewards to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.rewards to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.routing_candidates to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.routing_candidates to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.routing_candidates to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.services to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.services to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.services to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.shops_mechanics_cleaning to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.shops_mechanics_cleaning to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.shops_mechanics_cleaning to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.signup_invites to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.sync_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.sync_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.sync_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tasks to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tasks to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tasks to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.team_onboarding to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.team_onboarding to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.team_onboarding to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tickets to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tickets to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tickets to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.time_clock_entries to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.time_clock_entries to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.time_clock_entries to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_balances to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_balances to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_balances to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_ledger to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_ledger to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.tmmt_token_ledger to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.training_module_progress to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.training_module_progress to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.training_module_progress to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.training_modules to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.training_modules to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.training_modules to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.unit_locations to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.unit_locations to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.unit_locations to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.units to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.units to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.units to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_affiliate_open_market to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_affiliate_open_market to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_affiliate_open_market to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_bills_dashboard to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_bills_dashboard to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_bills_dashboard to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_call_sheet_today to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_call_sheet_today to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_call_sheet_today to service_role;
grant delete, insert, maintain, references, trigger, truncate, update on public.v_collections_truth to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_collections_truth to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_collections_truth to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_enforcement_radar to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_federation_handoffs to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_federation_handoffs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_federation_handoffs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_lead_provenance to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_lead_provenance to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_lead_provenance to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_license_audit to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_license_audit to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_license_audit to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_next_credit_partner to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_360 to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_360 to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_360 to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_network to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_network to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_network to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_watchtower to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_operator_watchtower to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_outreach_book to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_outreach_book to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_outreach_book to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_prequalified_leads to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_prequalified_leads to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_prequalified_leads to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_trap_money_flywheel to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.v_trap_money_summary to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_damage_reports to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_damage_reports to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_damage_reports to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_events to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_events to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_events to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_handover to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_handover to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_handover to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_media to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_media to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_media to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_onboarding_inspections to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_onboarding_inspections to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicle_onboarding_inspections to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicles to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vehicles to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_files to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_files to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_files to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_job_updates to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_job_updates to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_job_updates to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_jobs to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_jobs to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendor_jobs to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendors to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendors to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.vendors to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ventures to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ventures to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.ventures to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.verticals to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.verticals to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.verticals to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.waitlist to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.waitlist to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.waitlist to service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.work_assignments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.work_assignments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on public.work_assignments to service_role;

-- function execute grants
grant execute on function public.accept_handoff(p_referral_id uuid) to service_role;
grant execute on function public.acting_org_id() to anon;
grant execute on function public.acting_org_id() to authenticated;
grant execute on function public.acting_org_id() to service_role;
grant execute on function public.agency_pct_from_tier(p_tier partner_revenue_split_tier) to authenticated;
grant execute on function public.agency_pct_from_tier(p_tier partner_revenue_split_tier) to service_role;
grant execute on function public.agent_claim_jobs(p_worker text, p_limit integer) to service_role;
grant execute on function public.agent_complete_job(p_job_id bigint, p_response text, p_error text) to service_role;
grant execute on function public.agent_enqueue() to service_role;
grant execute on function public.agent_open_load(p_profile uuid) to authenticated;
grant execute on function public.agent_open_load(p_profile uuid) to service_role;
grant execute on function public.agent_render_prompt(p_template text, p_row jsonb) to anon;
grant execute on function public.agent_render_prompt(p_template text, p_row jsonb) to authenticated;
grant execute on function public.agent_render_prompt(p_template text, p_row jsonb) to service_role;
grant execute on function public.app_auth_role() to authenticated;
grant execute on function public.app_auth_role() to service_role;
grant execute on function public.assign_lead_idle(p_lead uuid) to service_role;
grant execute on function public.assign_unit(p_incident_id uuid, p_unit_id uuid, p_by_kind text, p_by_user uuid, p_weight numeric, p_reasoning jsonb) to authenticated;
grant execute on function public.assign_unit(p_incident_id uuid, p_unit_id uuid, p_by_kind text, p_by_user uuid, p_weight numeric, p_reasoning jsonb) to service_role;
grant execute on function public.assign_va_to_operator(p_operator uuid, p_va_profile uuid, p_role text) to service_role;
grant execute on function public.assign_work(p_case_id uuid, p_candidate_id uuid, p_by_kind text, p_by_user uuid, p_score numeric, p_reasoning jsonb) to service_role;
grant execute on function public.auto_route_intake() to anon;
grant execute on function public.auto_route_intake() to authenticated;
grant execute on function public.auto_route_intake() to service_role;
grant execute on function public.backend_unlocked_for(p_user uuid) to service_role;
grant execute on function public.backfill_lead_intake(p_limit integer) to service_role;
grant execute on function public.bg_check_decide(p_id uuid, p_decision text, p_notes text) to authenticated;
grant execute on function public.bg_check_decide(p_id uuid, p_decision text, p_notes text) to service_role;
grant execute on function public.bg_check_queue(p_status text, p_limit integer) to authenticated;
grant execute on function public.bg_check_queue(p_status text, p_limit integer) to service_role;
grant execute on function public.bills_touch_updated_at() to authenticated;
grant execute on function public.bills_touch_updated_at() to service_role;
grant execute on function public.bind_install(p_org uuid, p_token text, p_hardware_uuid text) to service_role;
grant execute on function public.book_operator_commission(p_operator uuid, p_gross_cents integer, p_period_start date, p_period_end date, p_recurring_pct smallint) to service_role;
grant execute on function public.capture_form_intake() to anon;
grant execute on function public.capture_form_intake() to authenticated;
grant execute on function public.capture_form_intake() to service_role;
grant execute on function public.capture_handoff_consent(p_referral_id uuid, p_consent_channel text) to service_role;
grant execute on function public.capture_lead_intake() to anon;
grant execute on function public.capture_lead_intake() to authenticated;
grant execute on function public.capture_lead_intake() to service_role;
grant execute on function public.certify_operator(p_profile_id uuid, p_track text, p_total_score smallint, p_scored_by uuid) to service_role;
grant execute on function public.claim_agent_job(p_worker text) to service_role;
grant execute on function public.claim_open_referral(p_referral_id uuid, p_operator uuid) to service_role;
grant execute on function public.classify_program(p_text text) to anon;
grant execute on function public.classify_program(p_text text) to authenticated;
grant execute on function public.classify_program(p_text text) to service_role;
grant execute on function public.compute_good_standing(p_email text) to service_role;
grant execute on function public.compute_lto_eligible(p_profile_id uuid, p_email text) to service_role;
grant execute on function public.create_affiliate_link(p_operator uuid, p_recurring_pct smallint, p_landing text) to service_role;
grant execute on function public.credit_base_path_satisfied(p_journey_id uuid) to service_role;
grant execute on function public.credit_education_complete(p_profile_id uuid) to service_role;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_organization_id() to service_role;
grant execute on function public.current_profile_email() to authenticated;
grant execute on function public.current_profile_email() to service_role;
grant execute on function public.current_role() to authenticated;
grant execute on function public.current_role() to service_role;
grant execute on function public.dispute_clients_touch_updated_at() to anon;
grant execute on function public.dispute_clients_touch_updated_at() to authenticated;
grant execute on function public.dispute_clients_touch_updated_at() to service_role;
grant execute on function public.enforce_handoff_consent() to authenticated;
grant execute on function public.enforce_handoff_consent() to service_role;
grant execute on function public.enforce_operator_cap() to anon;
grant execute on function public.enforce_operator_cap() to authenticated;
grant execute on function public.enforce_operator_cap() to service_role;
grant execute on function public.eval_money_rails(p_token text) to anon;
grant execute on function public.eval_money_rails(p_token text) to authenticated;
grant execute on function public.eval_money_rails(p_token text) to service_role;
grant execute on function public.expense_fill_from_vehicle() to anon;
grant execute on function public.expense_fill_from_vehicle() to authenticated;
grant execute on function public.expense_fill_from_vehicle() to service_role;
grant execute on function public.fail_agent_job(p_id bigint, p_error text) to service_role;
grant execute on function public.find_best_unit(p_incident_id uuid) to authenticated;
grant execute on function public.find_best_unit(p_incident_id uuid) to service_role;
grant execute on function public.finish_agent_job(p_id bigint, p_response text) to service_role;
grant execute on function public.fn_moe_taha_cut_cents(gross_cents integer, tier text) to authenticated;
grant execute on function public.fn_moe_taha_cut_cents(gross_cents integer, tier text) to service_role;
grant execute on function public.fn_round_robin_assign(p_assignees uuid[], p_lanes text[], p_max_each integer, p_dry_run boolean) to anon;
grant execute on function public.fn_round_robin_assign(p_assignees uuid[], p_lanes text[], p_max_each integer, p_dry_run boolean) to authenticated;
grant execute on function public.fn_round_robin_assign(p_assignees uuid[], p_lanes text[], p_max_each integer, p_dry_run boolean) to service_role;
grant execute on function public.generate_daily_brief(p_org uuid) to service_role;
grant execute on function public.generate_va_tasks() to service_role;
grant execute on function public.get_partner_fleet() to authenticated;
grant execute on function public.get_partner_fleet() to service_role;
grant execute on function public.ghl_appointments_set_updated() to authenticated;
grant execute on function public.ghl_appointments_set_updated() to service_role;
grant execute on function public.ghl_contacts_set_updated() to authenticated;
grant execute on function public.ghl_contacts_set_updated() to service_role;
grant execute on function public.ghl_intake_lead(p jsonb) to service_role;
grant execute on function public.ghl_intake_verification_form(p jsonb) to service_role;
grant execute on function public.guardian_scan() to service_role;
grant execute on function public.handle_new_auth_user() to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.intake_capture(p_source text, p_record_id text, p_haystack text, p_payload jsonb, p_org uuid) to service_role;
grant execute on function public.intake_signal(p_text text) to anon;
grant execute on function public.intake_signal(p_text text) to authenticated;
grant execute on function public.intake_signal(p_text text) to service_role;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_internal_ops() to authenticated;
grant execute on function public.is_internal_ops() to service_role;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_manager() to service_role;
grant execute on function public.is_org_dispatcher(p_org_id uuid) to authenticated;
grant execute on function public.is_org_dispatcher(p_org_id uuid) to service_role;
grant execute on function public.is_org_member(p_org_id uuid) to authenticated;
grant execute on function public.is_org_member(p_org_id uuid) to service_role;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_owner() to service_role;
grant execute on function public.is_partner() to authenticated;
grant execute on function public.is_partner() to service_role;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_platform_admin() to service_role;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_staff() to service_role;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_super_admin() to service_role;
grant execute on function public.lead_to_active_customer() to anon;
grant execute on function public.lead_to_active_customer() to authenticated;
grant execute on function public.lead_to_active_customer() to service_role;
grant execute on function public.leadnet_daily_digest() to service_role;
grant execute on function public.leadnet_post_slack(msg text) to service_role;
grant execute on function public.leadnet_sla_sweep() to service_role;
grant execute on function public.leadnet_start_clock() to service_role;
grant execute on function public.leads_feed(p_secret text) to service_role;
grant execute on function public.license_heartbeat(p_org uuid, p_hardware_uuid text) to service_role;
grant execute on function public.lock_expired_assignments(p_org_id uuid) to authenticated;
grant execute on function public.lock_expired_assignments(p_org_id uuid) to service_role;
grant execute on function public.log_case_status_change() to service_role;
grant execute on function public.log_change(payload jsonb) to service_role;
grant execute on function public.mint_install_token(p_org uuid) to service_role;
grant execute on function public.moe_portal_touch_updated_at() to authenticated;
grant execute on function public.moe_portal_touch_updated_at() to service_role;
grant execute on function public.money_meter_record(p_org uuid, p_direction text, p_category text, p_amount numeric, p_source text, p_ref text, p_dedupe text, p_meta jsonb) to service_role;
grant execute on function public.money_meter_summary(p_since timestamp with time zone) to anon;
grant execute on function public.money_meter_summary(p_since timestamp with time zone) to authenticated;
grant execute on function public.money_meter_summary(p_since timestamp with time zone) to service_role;
grant execute on function public.money_meter_summary_by_category(p_since timestamp with time zone) to anon;
grant execute on function public.money_meter_summary_by_category(p_since timestamp with time zone) to authenticated;
grant execute on function public.money_meter_summary_by_category(p_since timestamp with time zone) to service_role;
grant execute on function public.my_operator_book(p_operator uuid) to authenticated;
grant execute on function public.my_operator_book(p_operator uuid) to service_role;
grant execute on function public.my_operator_earnings(p_operator uuid) to authenticated;
grant execute on function public.my_operator_earnings(p_operator uuid) to service_role;
grant execute on function public.next_case_number() to authenticated;
grant execute on function public.next_case_number() to service_role;
grant execute on function public.next_dsp_ref_code() to authenticated;
grant execute on function public.next_dsp_ref_code() to service_role;
grant execute on function public.next_ref_code() to authenticated;
grant execute on function public.next_ref_code() to service_role;
grant execute on function public.normalize_phone_e164(raw text) to authenticated;
grant execute on function public.normalize_phone_e164(raw text) to service_role;
grant execute on function public.notify_new_fleet_vehicle() to anon;
grant execute on function public.notify_new_fleet_vehicle() to authenticated;
grant execute on function public.notify_new_fleet_vehicle() to service_role;
grant execute on function public.on_new_lead() to anon;
grant execute on function public.on_new_lead() to authenticated;
grant execute on function public.on_new_lead() to service_role;
grant execute on function public.onboard_org_member(p_email text, p_org_id uuid, p_role text) to authenticated;
grant execute on function public.onboard_org_member(p_email text, p_org_id uuid, p_role text) to service_role;
grant execute on function public.operator_academy_complete(p_profile_id uuid, p_track text) to service_role;
grant execute on function public.operator_checkin(p_org uuid, p_hardware_uuid text, p_key_hash text, p_action text, p_ip inet, p_payload jsonb) to service_role;
grant execute on function public.operator_provision(p_org uuid, p_install_token text, p_hardware_uuid text, p_new_key_hash text, p_ip inet) to service_role;
grant execute on function public.operator_self_certify() to authenticated;
grant execute on function public.operator_self_certify() to service_role;
grant execute on function public.org_has_module(p_module text) to authenticated;
grant execute on function public.org_has_module(p_module text) to service_role;
grant execute on function public.org_id_for_host(p_host text) to anon;
grant execute on function public.org_id_for_host(p_host text) to authenticated;
grant execute on function public.org_id_for_host(p_host text) to service_role;
grant execute on function public.partner_business_owner_eligible(p_has_capital boolean, p_vehicle_count integer) to authenticated;
grant execute on function public.partner_business_owner_eligible(p_has_capital boolean, p_vehicle_count integer) to service_role;
grant execute on function public.partner_pct_from_tier(p_tier partner_revenue_split_tier) to authenticated;
grant execute on function public.partner_pct_from_tier(p_tier partner_revenue_split_tier) to service_role;
grant execute on function public.partner_retail_eligible(p_has_own_system boolean) to authenticated;
grant execute on function public.partner_retail_eligible(p_has_own_system boolean) to service_role;
grant execute on function public.partner_tier_allowed_for_segment(p_segment partner_client_segment, p_tier partner_revenue_split_tier, p_has_own_system boolean, p_has_capital boolean, p_vehicle_count integer) to authenticated;
grant execute on function public.partner_tier_allowed_for_segment(p_segment partner_client_segment, p_tier partner_revenue_split_tier, p_has_own_system boolean, p_has_capital boolean, p_vehicle_count integer) to service_role;
grant execute on function public.partner_vehicle_rentals() to authenticated;
grant execute on function public.partner_vehicle_rentals() to service_role;
grant execute on function public.pick_idle_closer(p_org uuid) to authenticated;
grant execute on function public.pick_idle_closer(p_org uuid) to service_role;
grant execute on function public.pick_next_closer(p_org uuid) to service_role;
grant execute on function public.program_applications_set_updated_at() to authenticated;
grant execute on function public.program_applications_set_updated_at() to service_role;
grant execute on function public.promote_ghl_contact() to service_role;
grant execute on function public.provision_install_token(p_org uuid) to service_role;
grant execute on function public.provision_operator(p_email text, p_revenue_share_pct smallint, p_level text, p_license_fee_cents integer) to service_role;
grant execute on function public.provision_operator_full(p_email text, p_name text, p_city text, p_vertical text, p_plan_tier text, p_revenue_share_pct smallint, p_license_fee_cents integer, p_monthly_tokens integer) to service_role;
grant execute on function public.provision_operator_webhook(p_secret text, p_payload jsonb) to service_role;
grant execute on function public.rank_work_candidates(p_case_id uuid) to service_role;
grant execute on function public.rebalance_all_orgs(p_max_age interval) to service_role;
grant execute on function public.rebalance_stale_leads(p_org uuid, p_max_age interval) to service_role;
grant execute on function public.recall_memory_facts_local(p_org uuid, p_query text, p_k integer) to authenticated;
grant execute on function public.recall_memory_facts_local(p_org uuid, p_query text, p_k integer) to service_role;
grant execute on function public.recall_memory_local(p_org uuid, p_query text, p_k integer) to authenticated;
grant execute on function public.recall_memory_local(p_org uuid, p_query text, p_k integer) to service_role;
grant execute on function public.recompute_journey(p_email text) to service_role;
grant execute on function public.reinstate_license(p_org uuid) to service_role;
grant execute on function public.request_handoff(p_source_org text, p_dest_org text, p_contact_ref text, p_reason text, p_consent_channel text, p_commission_cents integer) to authenticated;
grant execute on function public.request_handoff(p_source_org text, p_dest_org text, p_contact_ref text, p_reason text, p_consent_channel text, p_commission_cents integer) to service_role;
grant execute on function public.revoke_license(p_org uuid, p_reason text) to service_role;
grant execute on function public.route_intake_event(p_id bigint) to service_role;
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.submit_customer_intake(p_contact_name text, p_phone text, p_email text, p_request_type text, p_description text, p_priority text) to anon;
grant execute on function public.submit_customer_intake(p_contact_name text, p_phone text, p_email text, p_request_type text, p_description text, p_priority text) to authenticated;
grant execute on function public.submit_customer_intake(p_contact_name text, p_phone text, p_email text, p_request_type text, p_description text, p_priority text) to service_role;
grant execute on function public.sweep_overdue_payments() to service_role;
grant execute on function public.sweep_payment_due_notices() to service_role;
grant execute on function public.tasks_set_updated_at() to anon;
grant execute on function public.tasks_set_updated_at() to authenticated;
grant execute on function public.tasks_set_updated_at() to service_role;
grant execute on function public.tg_attrib_affiliate() to service_role;
grant execute on function public.tg_auto_assign_lead() to service_role;
grant execute on function public.tg_notify_handoff_slack() to service_role;
grant execute on function public.tg_validate_and_verify_lead() to service_role;
grant execute on function public.tmmt_token_grant(p_org uuid, p_amount integer, p_reason text, p_dedupe text, p_set_allotment integer, p_tier text) to authenticated;
grant execute on function public.tmmt_token_grant(p_org uuid, p_amount integer, p_reason text, p_dedupe text, p_set_allotment integer, p_tier text) to service_role;
grant execute on function public.tmmt_token_spend(p_org uuid, p_cost integer, p_job text) to service_role;
grant execute on function public.touch_comm_channels_updated_at() to authenticated;
grant execute on function public.touch_comm_channels_updated_at() to service_role;
grant execute on function public.touch_customer_services_updated_at() to authenticated;
grant execute on function public.touch_customer_services_updated_at() to service_role;
grant execute on function public.touch_installations_updated_at() to authenticated;
grant execute on function public.touch_installations_updated_at() to service_role;
grant execute on function public.touch_memory_entity_updated_at() to authenticated;
grant execute on function public.touch_memory_entity_updated_at() to service_role;
grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.touch_updated_at() to service_role;
grant execute on function public.touch_updated_at_generic() to authenticated;
grant execute on function public.touch_updated_at_generic() to service_role;
grant execute on function public.training_core_complete(p_profile_id uuid) to service_role;
grant execute on function public.update_updated_at_column() to authenticated;
grant execute on function public.update_updated_at_column() to service_role;


