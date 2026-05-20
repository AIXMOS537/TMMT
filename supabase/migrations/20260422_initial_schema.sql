-- Generated schema from Airtable metadata
-- Applies to Supabase project: uapxakmlwnpfsftfeezx

create extension if not exists "pgcrypto";

create table if not exists "incoming_leads" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "contact_name" text,
  "opportunity_name" text,
  "phone" numeric,
  "email" text,
  "priority_level" text,
  "created_on" timestamptz,
  "status" text,
  "notes" text,
  "fleet" text,
  "car_inspections" text,
  "updated_on" timestamptz,
  "last_modified_time" timestamptz,
  "lead_verification" text,
  "waitlist" text,
  "do_not_rent_list" text,
  "background_checks" text,
  "rating" text,
  "phone_text" text
);

create table if not exists "background_checks" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "customer_name" text,
  "phone_number" text,
  "email" text,
  "driver_s_license" jsonb,
  "own_insurance" text,
  "proof_of_insurance" jsonb,
  "paystub" jsonb,
  "verificaton_form_submitted" boolean,
  "background_check_screenshot" jsonb,
  "key_details_extracted_from_screenshot" text,
  "review_notes" text,
  "eligibility_status" text,
  "available_vehicles" text,
  "waitlist" text,
  "customer_id" bigint,
  "background_check_status" text,
  "insurance_check_status" text,
  "earnings_verification_status" text,
  "date_verified" date,
  "linked_lead" text,
  "verification_form_submitted" boolean
);

create table if not exists "waitlist" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "customer_name" text,
  "linked_background_check" text,
  "customer_phone" text,
  "customer_email" text,
  "vehicle_type" text,
  "desired_specifications_notes" text,
  "status" text,
  "appointments" text,
  "desired_weekly_payment" numeric,
  "make" text,
  "model" text,
  "year" numeric,
  "date_added_to_waitlist" date,
  "desired_specs_notes" text
);

create table if not exists "appointments" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "appointment_id" bigint,
  "waitlist_customer" text,
  "appointment_type" text,
  "vehicle_preference_confirmed" boolean,
  "preferred_vehicle_make_model" text,
  "appointment_date_time" timestamptz,
  "appointment_status" text,
  "assigned_staff" text,
  "location" text,
  "notes" text,
  "confirmed_time_slot" text,
  "appointment_time" text,
  "status" text,
  "phone" text,
  "email" text,
  "appointment_date" date,
  "customer_name" text
);

create table if not exists "fleet" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "vehicle_name" text,
  "partner_name" text,
  "vehicle_status" text,
  "year" numeric,
  "vehicle_make" text,
  "vehicle_model" text,
  "color" text,
  "vehicle_pictures" jsonb,
  "finance_status" text,
  "weekly_prices" text[],
  "lowest_possible_price" numeric,
  "customer" text,
  "vin" text,
  "license_plate" text,
  "mileage" numeric,
  "type" text,
  "last_maintenance_date" date,
  "notes" text,
  "vehicle_maintenance_records" text,
  "vehicle_expenses" text,
  "insurance" text,
  "tickets" text,
  "registration" jsonb,
  "car_inspection_photos" jsonb,
  "vehicle_emissions_inspections" jsonb,
  "partner_percentage" numeric,
  "background_checks" text,
  "active_customers" text,
  "car_inspections" text,
  "customer_inspection_photos" text,
  "contracts" text,
  "vehicle_handover" text,
  "maintenance_appointments" text,
  "vehicle_onboarding_inspections" text,
  "expenses" text,
  "social_media_posts" text,
  "customers_copy" text,
  "records_nested" text,
  "from_field_records_nested" text
);

create table if not exists "vehicle_handover" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "handover_id" bigint,
  "contract" text,
  "active_customer" text,
  "fleet_vehicle" text,
  "handover_date" timestamptz,
  "required_docs_provided" boolean,
  "document_verification_status" text,
  "handover_checklist_staff" jsonb,
  "customer_checklist_received_documents" jsonb,
  "notes" text,
  "handover_status" text,
  "inspection_documents_provided" boolean,
  "registration_documents_provided" boolean,
  "insurance_documents_provided" boolean,
  "handover_notes" text,
  "customer_name" text,
  "staff_name" text,
  "vehicle_make" text,
  "vehicle_model" text,
  "license_plate" text,
  "odometer_reading" numeric,
  "fuel_level" text,
  "check_exterior" boolean,
  "check_interior" boolean,
  "check_tires" boolean,
  "check_lights" boolean,
  "check_documents" boolean,
  "condition_notes" text,
  "customer_signature" text,
  "handover_type" text,
  "status" text
);

create table if not exists "active_customers" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "customer_name" text,
  "contact_phone" text,
  "contact_email" text,
  "vehicle_rented" text,
  "status" text,
  "repo_status" text,
  "vehicle_plate" text,
  "vehicle_vin" text,
  "rental_start_date" date,
  "payment_amount" text,
  "payment_frequency" text,
  "service_notes" text,
  "scheduled_maintenance" timestamptz,
  "payment_reliability_rating" text,
  "ticket_balance_status" text,
  "tickets_2" text,
  "license_plate" text,
  "vin" text,
  "tickets" text
);

create table if not exists "customer_payments" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "customer" text,
  "customer_phone_number" text,
  "payment_method" text,
  "last_payment_date" date,
  "amount" numeric,
  "next_payment_due_date" date,
  "notes" text,
  "payment_status" text,
  "past_due_dates" text,
  "amout_past_due" text,
  "payment_plan" text,
  "invoice_receipt_attachment" jsonb,
  "payment_id" text,
  "customer_name" text,
  "vehicle" text,
  "vehicle_name" text
);

create table if not exists "insurance" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "insured_vehicle" text,
  "insured_customer" text,
  "insured_entity_type" text,
  "insurance_company_name" text,
  "policy_number" text,
  "login_email" text,
  "login_password" text,
  "login_phone" text,
  "insurance_due_date" text,
  "insurance_payment_amount" text,
  "personal_insurance_policy" text,
  "policy_type" text,
  "coverage_amount" numeric,
  "deductible" numeric,
  "policy_start_date" date,
  "policy_end_date" date,
  "insurance_status" text,
  "proof_of_insurance_attachment" jsonb,
  "notes" text,
  "related_expenses" text,
  "renewal_reminder_date" date,
  "commercial_insurance_policy_number" jsonb,
  "tickets" text,
  "insured_customer_link" text
);

create table if not exists "tickets" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "ticket_id" bigint,
  "requested_by_customer" text,
  "citation" text,
  "related_vehicle" text,
  "attachments_screenshots_docs_photos" jsonb,
  "description_issue_details" text,
  "status" text,
  "priority" text,
  "amount" numeric,
  "violation_type" text,
  "date_created" date,
  "follow_up_date" date,
  "internal_notes" text,
  "date_closed" date,
  "created_by" text,
  "if_selected_others_specify_violation_type" text,
  "customer_linked" text,
  "ticket_balance_status" text,
  "total_customer_ticket_balance" text,
  "phone" text,
  "vehicle_description" text,
  "issue_type" text,
  "urgency" text,
  "description" text,
  "location" text,
  "customer_name" text
);

create table if not exists "expenses" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "vehicle_name" text,
  "vehicle" text,
  "expense_date" date,
  "expense_type" text,
  "amount" numeric,
  "vendor_payee" text,
  "rental_vehicle" text,
  "description" text,
  "attachments" jsonb,
  "assignee" text,
  "status" text,
  "partner_name" text,
  "customer" text,
  "notes" text,
  "operations_management" text,
  "insurance" text,
  "tickets" text,
  "from_field_vendor_payee" text,
  "vehicle_maintenance_records" text
);

create table if not exists "fleet_car_inspections" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "inspection_name" text,
  "date_of_inspection" date,
  "inspector_name" text,
  "fleet_vehicle" text,
  "odometer_reading_at_inspection" numeric,
  "inspection_attachments" jsonb,
  "inspection_notes" text,
  "inspection_status" text,
  "customer_if_applicable" text,
  "next_scheduled_inspection" date,
  "is_followup_needed" text,
  "related_maintenance_record" text,
  "customer_inspection_photos" text,
  "inspection_type" text,
  "status" text
);

create table if not exists "customer_inspection_photos" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "full_name" text,
  "vehicle_name" text,
  "vehicle_photos" jsonb,
  "odometer_reading" numeric,
  "date_time" timestamptz,
  "interion_clean" boolean,
  "i_confirm_that_the_above_photos_and_details_accurately_reflect_the_vehicle_s_condition_before_leaving_tmmt_rentals_premises" boolean,
  "created_by" text,
  "exterior_clean" boolean,
  "record" text,
  "interior_clean" boolean,
  "confirmation" boolean
);

create table if not exists "shops_mechanics_cleaning" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "vendor_payee" text,
  "phone_number" text,
  "email_address" text,
  "point_of_contact" text,
  "notes" text,
  "attachment_summary" text,
  "expenses" text
);

create table if not exists "employee_access_rights" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "employee_name" text,
  "employee_email" text,
  "tool_software" text,
  "access_level" text,
  "date_granted" date,
  "date_revoked" date,
  "website_access" text[],
  "active_access" text,
  "access_requested_by" text,
  "notes" text
);

create table if not exists "maintenance_appointments" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "maintenance_appointment_id" bigint,
  "fleet_vehicle" text,
  "active_customer_if_applicable" text,
  "appointment_date_time" timestamptz,
  "maintenance_type" text,
  "assigned_staff" text,
  "status" text,
  "service_provider_location" text,
  "notes" text,
  "fee_assessed_if_no_show_late" numeric,
  "was_customer_notified_of_fee" boolean,
  "appointment_date" date
);

create table if not exists "do_not_rent_list" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "person_entity_name" text,
  "contact_email" text,
  "contact_phone" text,
  "driver_s_license" jsonb,
  "reason_for_restriction" text,
  "date_added" date,
  "source_of_restriction" text,
  "notes" text,
  "alert_category_ai" text
);

create table if not exists "operation_costs" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "tool_software_name" text,
  "type" text,
  "description" text,
  "category" text[],
  "license_subscription_status" text,
  "prices" numeric,
  "employee_access_rights" text
);

create table if not exists "contracts" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "contract_id" bigint,
  "active_customer" text,
  "vehicle" text,
  "start_date" date,
  "end_date" date,
  "base_price" numeric,
  "taxes_and_fees" numeric,
  "insurance_fee" numeric,
  "total_contract_amount" numeric,
  "signatures_customer_staff" jsonb,
  "contract_status" text,
  "addendums" jsonb,
  "notes" text,
  "contract_sent_date" date,
  "signed_date" date,
  "vehicle_handover" text,
  "former_customers" text,
  "status" text
);

create table if not exists "vehicle_onboarding_inspections" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "inspection_id" bigint,
  "inspection_date" date,
  "inspector_name" text,
  "fleet_vehicle" text,
  "mechanical_inspection_result" text,
  "mechanical_notes" text,
  "cleanliness_status" text,
  "cleanliness_notes" text,
  "tracker_installation_status" text,
  "tracker_install_notes" text,
  "keys_verification_status" text,
  "document_verification_status" text,
  "documents_uploaded" jsonb,
  "photos_condition_docs" jsonb,
  "general_notes" text,
  "inspection_status" text,
  "onboarding_checklist_completion" numeric,
  "flag_for_followup" boolean,
  "onboarding_stage" text,
  "ai_summary_next_steps" text,
  "ai_urgency_level" text,
  "cleaned_detailed_status" text,
  "cleaned_detailed_notes" text,
  "make" text,
  "model" text,
  "year" text,
  "vin" text,
  "license_plate" text,
  "color" text,
  "odometer" numeric,
  "overall_rating" text,
  "notes" text,
  "status" text,
  "tire_pressure_fl" numeric,
  "tire_pressure_fr" numeric,
  "tire_pressure_rl" numeric,
  "tire_pressure_rr" numeric
);

create table if not exists "former_customers" (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  "customer_name" text,
  "contact_email" text,
  "contact_phone" text,
  "rental_start_date" date,
  "rental_end_date" date,
  "vehicle_rented" text,
  "license_plate" text,
  "vin" text,
  "reason_for_removal" text,
  "future_upsell_opportunities_ai" text,
  "last_payment_date" date,
  "contracts" text,
  "customer_payments" text,
  "notes" text
);

create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

create trigger incoming_leads_set_updated_at before update on "incoming_leads" for each row execute function public.set_updated_at();
create trigger background_checks_set_updated_at before update on "background_checks" for each row execute function public.set_updated_at();
create trigger waitlist_set_updated_at before update on "waitlist" for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on "appointments" for each row execute function public.set_updated_at();
create trigger fleet_set_updated_at before update on "fleet" for each row execute function public.set_updated_at();
create trigger vehicle_handover_set_updated_at before update on "vehicle_handover" for each row execute function public.set_updated_at();
create trigger active_customers_set_updated_at before update on "active_customers" for each row execute function public.set_updated_at();
create trigger customer_payments_set_updated_at before update on "customer_payments" for each row execute function public.set_updated_at();
create trigger insurance_set_updated_at before update on "insurance" for each row execute function public.set_updated_at();
create trigger tickets_set_updated_at before update on "tickets" for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on "expenses" for each row execute function public.set_updated_at();
create trigger fleet_car_inspections_set_updated_at before update on "fleet_car_inspections" for each row execute function public.set_updated_at();
create trigger customer_inspection_photos_set_updated_at before update on "customer_inspection_photos" for each row execute function public.set_updated_at();
create trigger shops_mechanics_cleaning_set_updated_at before update on "shops_mechanics_cleaning" for each row execute function public.set_updated_at();
create trigger employee_access_rights_set_updated_at before update on "employee_access_rights" for each row execute function public.set_updated_at();
create trigger maintenance_appointments_set_updated_at before update on "maintenance_appointments" for each row execute function public.set_updated_at();
create trigger do_not_rent_list_set_updated_at before update on "do_not_rent_list" for each row execute function public.set_updated_at();
create trigger operation_costs_set_updated_at before update on "operation_costs" for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on "contracts" for each row execute function public.set_updated_at();
create trigger vehicle_onboarding_inspections_set_updated_at before update on "vehicle_onboarding_inspections" for each row execute function public.set_updated_at();
create trigger former_customers_set_updated_at before update on "former_customers" for each row execute function public.set_updated_at();