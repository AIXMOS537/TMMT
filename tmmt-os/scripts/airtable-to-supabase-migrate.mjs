#!/usr/bin/env node
/**
 * Airtable → Supabase reconciliation / migration.
 *
 * Purpose: make Supabase the single source of truth so the Airtable base can be
 * cancelled (cost cut, see SHIELD-AUDIT). Every Supabase table has an `airtable_id`
 * column, so this UPSERTS on `airtable_id` — safe to re-run, never duplicates.
 *
 * SAFE BY DEFAULT: dry-run unless you pass --commit.
 *
 *   node scripts/airtable-to-supabase-migrate.mjs                 # dry-run, all mapped tables
 *   node scripts/airtable-to-supabase-migrate.mjs --table=fleet   # one table
 *   node scripts/airtable-to-supabase-migrate.mjs --commit        # actually write
 *   node scripts/airtable-to-supabase-migrate.mjs --table=incoming_leads --commit
 *
 * Env required (in tmmt-os/.env.local):
 *   AIRTABLE_PAT                  Airtable personal access token (read scope)
 *   AIRTABLE_BASE_ID             default: appcenWUju039rD7b
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    (server-only; bypasses RLS for the backfill)
 *
 * NOTE: attachment + record-link + formula/rollup fields are intentionally skipped
 * (they don't map cleanly to scalar columns). Scalars, dates, numbers, currency,
 * selects, barcodes are handled. Confirm each table's mapping before --commit.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- tiny .env.local loader (no extra deps) ---
const envPath = join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const COMMIT = process.argv.includes("--commit");
const ONLY = (process.argv.find((a) => a.startsWith("--table=")) || "").split("=")[1] || null;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID || "appcenWUju039rD7b";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!AIRTABLE_PAT || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: need AIRTABLE_PAT, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Coerce an Airtable cell into a scalar Postgres-friendly value.
function coerce(v) {
  if (v == null) return null;
  if (Array.isArray(v)) {
    // attachments / record links / multi-select → skip arrays of objects, join scalars
    if (v.length && typeof v[0] === "object") return null; // attachments/links — skip
    return v.join(", ");
  }
  if (typeof v === "object") {
    if ("text" in v) return v.text; // barcode
    if ("name" in v) return v.name; // collaborator/select object
    return null; // unknown object → skip
  }
  return v;
}

/**
 * TABLE_MAP: supabaseTable -> { airtableTable, fields: { "Airtable Field": "supabase_column" } }
 * `airtable_id` is set automatically from the Airtable record id.
 * ✅ = field-mapped & ready. TODO tables list their Airtable fields so finishing them is mechanical.
 */
const TABLE_MAP = {
  // ✅ incoming_leads (777 in Supabase already — this catches stragglers)
  incoming_leads: {
    airtableTable: "Incoming Leads",
    fields: {
      "Contact Name": "contact_name", "Opportunity Name": "opportunity_name",
      phone: "phone", email: "email", "Priority Level": "priority_level",
      "Created on": "created_on", Status: "status", Notes: "notes",
      "Lead Verification": "lead_verification", Rating: "rating",
    },
  },
  // ✅ customer_payments
  customer_payments: {
    airtableTable: "Customer Payments",
    fields: {
      Customer: "customer", "Customer Phone Number": "customer_phone_number",
      "Payment Method": "payment_method", "Last Payment Date": "last_payment_date",
      Amount: "amount", "Next Payment Due Date": "next_payment_due_date", Notes: "notes",
      "Payment Status": "payment_status", "Past Due Dates": "past_due_dates",
      "Amout Past Due": "amout_past_due", "Payment Plan": "payment_plan", "Payment ID": "payment_id",
    },
  },
  // ✅ background_checks (303 already; PII — handle with care)
  background_checks: {
    airtableTable: "Background Checks",
    fields: {
      "Customer Name": "customer_name", "Phone Number": "phone_number", Email: "email",
      "Own Insurance?": "own_insurance", "Verificaton form Submitted?": "verificaton_form_submitted",
      "Key Details (Extracted from Screenshot)": "key_details_extracted_from_screenshot",
      "Review Notes": "review_notes", "Eligibility Status": "eligibility_status",
      "Customer ID": "customer_id", "Background Check Status": "background_check_status",
      "Insurance Check Status": "insurance_check_status",
      "Earnings Verification Status": "earnings_verification_status", "Date Verified": "date_verified",
    },
  },
  // ✅ waitlist
  waitlist: {
    airtableTable: "Waitlist",
    fields: {
      "Customer Name": "customer_name", "Customer Phone": "customer_phone",
      "Customer Email": "customer_email", "Vehicle Type": "vehicle_type",
      "Desired Specifications / Notes": "desired_specifications_notes", Status: "status",
      "Desired Weekly Payment": "desired_weekly_payment", Make: "make", Model: "model",
      Year: "year", "Date Added to Waitlist": "date_added_to_waitlist",
    },
  },
  // ✅ fleet
  fleet: {
    airtableTable: "Fleet",
    fields: {
      "Vehicle Name": "vehicle_name", "Partner Name": "partner_name", "Vehicle Status": "vehicle_status",
      Year: "year", "Vehicle Make": "vehicle_make", "Vehicle Model": "vehicle_model", Color: "color",
      "Finance Status": "finance_status", "Lowest Possible Price": "lowest_possible_price",
      "VIN #": "vin", "License Plate": "license_plate", Mileage: "mileage", Type: "type",
      "Last Maintenance Date": "last_maintenance_date", Notes: "notes",
      "Partner Percentage": "partner_percentage", "Weekly Prices": "weekly_prices",
    },
  },
  // ✅ do_not_rent_list
  do_not_rent_list: {
    airtableTable: "Do Not Rent List",
    fields: {
      "Person/Entity Name": "person_entity_name", "Contact Email": "contact_email",
      "Contact Phone": "contact_phone", "Reason for Restriction": "reason_for_restriction",
      "Date Added": "date_added", "Source of Restriction": "source_of_restriction",
      Notes: "notes", "Alert Category (AI)": "alert_category_ai",
    },
  },

  // ✅ active_customers
  active_customers: {
    airtableTable: "Active Customers",
    fields: {
      "Customer Name": "customer_name", "Contact Phone": "contact_phone", "Contact Email": "contact_email",
      Status: "status", "Repo Status": "repo_status", "Rental Start Date": "rental_start_date",
      "Payment Amount ": "payment_amount", "Payment Frequency": "payment_frequency",
      "Service Notes": "service_notes", "Scheduled Maintenance": "scheduled_maintenance",
      "Payment Reliability Rating": "payment_reliability_rating", "License Plate": "license_plate", "VIN #": "vin",
    },
  },
  // ✅ insurance  ⚠️ contains login_email/login_password/login_phone — sensitive; already in both systems.
  insurance: {
    airtableTable: "Insurance",
    fields: {
      "Insured Vehicle": "insured_vehicle", "Insured Customer": "insured_customer",
      "Insured Entity Type": "insured_entity_type", "Insurance Company Name": "insurance_company_name",
      "Policy number": "policy_number", "LOGIN EMAIL": "login_email", "LOGIN PASSWORD": "login_password",
      "LOGIN PHONE": "login_phone", "Insurance due date": "insurance_due_date",
      "Insurance Payment Amount": "insurance_payment_amount", "Personal Insurance Policy #": "personal_insurance_policy",
      "Policy Type": "policy_type", "Coverage Amount": "coverage_amount", Deductible: "deductible",
      "Policy Start Date": "policy_start_date", "Policy End Date": "policy_end_date",
      "Insurance Status": "insurance_status", Notes: "notes", "Renewal Reminder Date": "renewal_reminder_date",
    },
  },
  // ✅ tickets
  tickets: {
    airtableTable: "Tickets",
    fields: {
      "Requested By (Customer)": "requested_by_customer", "Citation #": "citation",
      "Description / Issue Details": "description_issue_details", Status: "status", Priority: "priority",
      Amount: "amount", "Violation Type": "violation_type", "Date Created": "date_created",
      "Follow-up Date": "follow_up_date", "Internal Notes": "internal_notes", "Date Closed": "date_closed",
      'If selected "Others", specify Violation type': "if_selected_others_specify_violation_type",
    },
  },
  // ✅ expenses
  expenses: {
    airtableTable: "Expenses",
    fields: {
      "Vehicle Name": "vehicle_name", "Expense Date": "expense_date", "Expense Type": "expense_type",
      Amount: "amount", "Vendor / Payee": "vendor_payee", Description: "description", Assignee: "assignee",
      Status: "status", "Partner Name": "partner_name", Customer: "customer", Notes: "notes",
      "Operations - Management": "operations_management",
    },
  },
  // ✅ appointments
  appointments: {
    airtableTable: "Appointments",
    fields: {
      "Appointment Type": "appointment_type", "Vehicle Preference Confirmed": "vehicle_preference_confirmed",
      "Preferred Vehicle Make/Model": "preferred_vehicle_make_model",
      "Appointment Date & Time": "appointment_date_time", "Appointment Status": "appointment_status",
      "Assigned Staff": "assigned_staff", Location: "location", Notes: "notes",
      "Confirmed Time Slot": "confirmed_time_slot",
    },
  },
  // ✅ vehicle_handover
  vehicle_handover: {
    airtableTable: "Vehicle Handover",
    fields: {
      "Active Customer": "active_customer", "Handover Date": "handover_date",
      "Required Docs Provided": "required_docs_provided", "Document Verification Status": "document_verification_status",
      Notes: "notes", "Handover Status": "handover_status",
      "Inspection Documents Provided": "inspection_documents_provided",
      "Registration Documents Provided": "registration_documents_provided",
      "Insurance Documents Provided": "insurance_documents_provided", "Handover Notes": "handover_notes",
    },
  },
  // ✅ fleet_car_inspections
  fleet_car_inspections: {
    airtableTable: "Fleet Car Inspections",
    fields: {
      "Inspection Name": "inspection_name", "Date of Inspection": "date_of_inspection",
      "Inspector Name": "inspector_name", "Odometer Reading at Inspection": "odometer_reading_at_inspection",
      "Inspection Notes": "inspection_notes", "Inspection Status": "inspection_status",
      "Next Scheduled Inspection": "next_scheduled_inspection", "Is Followup Needed?": "is_followup_needed",
      "Inspection Type": "inspection_type",
    },
  },
  // ✅ customer_inspection_photos
  customer_inspection_photos: {
    airtableTable: "Customer Inspection Photos",
    fields: {
      "Full Name": "full_name", "Odometer Reading": "odometer_reading", "Date & Time": "date_time",
      "Interion Clean": "interion_clean", "Exterior Clean": "exterior_clean",
    },
  },
  // ✅ shops_mechanics_cleaning
  shops_mechanics_cleaning: {
    airtableTable: "Shops/ Mechanics/ Cleaning",
    fields: {
      "Vendor/Payee": "vendor_payee", "Phone Number": "phone_number", "Email address": "email_address",
      "Point of Contact": "point_of_contact", Notes: "notes",
    },
  },
  // ✅ employee_access_rights
  employee_access_rights: {
    airtableTable: "Employee Access Rights",
    fields: {
      "Employee Name": "employee_name", "Employee Email": "employee_email", "Access Level": "access_level",
      "Date Granted": "date_granted", "Date Revoked": "date_revoked", "Website Access": "website_access",
      "Active Access": "active_access", "Access Requested By": "access_requested_by", Notes: "notes",
    },
  },
  // ✅ maintenance_appointments
  maintenance_appointments: {
    airtableTable: "Maintenance Appointments",
    fields: {
      "Active Customer (if applicable)": "active_customer_if_applicable",
      "Appointment Date & Time": "appointment_date_time", "Maintenance Type": "maintenance_type",
      "Assigned Staff": "assigned_staff", Status: "status", "Service Provider/Location": "service_provider_location",
      Notes: "notes", "Fee Assessed (if No-Show/Late)": "fee_assessed_if_no_show_late",
      "Was Customer Notified of Fee?": "was_customer_notified_of_fee",
    },
  },
  // ✅ operation_costs
  operation_costs: {
    airtableTable: "Operation Costs",
    fields: {
      "Tool/Software Name": "tool_software_name", Type: "type", Description: "description",
      Category: "category", "License/Subscription Status": "license_subscription_status", Prices: "prices",
    },
  },
  // ✅ contracts
  contracts: {
    airtableTable: "Contracts",
    fields: {
      "Active Customer": "active_customer", "Start Date": "start_date", "End Date": "end_date",
      "Base Price": "base_price", "Taxes and Fees": "taxes_and_fees", "Insurance Fee": "insurance_fee",
      "Total Contract Amount": "total_contract_amount", "Contract Status": "contract_status", Notes: "notes",
      "Contract Sent Date": "contract_sent_date", "Signed Date": "signed_date",
    },
  },
  // ✅ vehicle_onboarding_inspections
  vehicle_onboarding_inspections: {
    airtableTable: "Vehicle Onboarding Inspections",
    fields: {
      "Inspection Date": "inspection_date", "Inspector Name": "inspector_name",
      "Mechanical Inspection Result": "mechanical_inspection_result", "Mechanical Notes": "mechanical_notes",
      "Cleanliness Status": "cleanliness_status", "Cleanliness Notes": "cleanliness_notes",
      "Tracker Installation Status": "tracker_installation_status", "Tracker Install Notes": "tracker_install_notes",
      "Keys Verification Status": "keys_verification_status",
      "Document Verification Status": "document_verification_status", "General Notes": "general_notes",
      "Inspection Status": "inspection_status", "Onboarding Checklist Completion %": "onboarding_checklist_completion",
      "Flag for Followup": "flag_for_followup", "Onboarding Stage": "onboarding_stage",
      "Cleaned/Detailed Status": "cleaned_detailed_status", "Cleaned/Detailed Notes": "cleaned_detailed_notes",
    },
  },
  // ✅ former_customers
  former_customers: {
    airtableTable: "Former Customers",
    fields: {
      "Customer Name": "customer_name", "Contact Email": "contact_email", "Contact Phone": "contact_phone",
      "Rental Start Date": "rental_start_date", "Rental End Date": "rental_end_date",
      "Vehicle Rented": "vehicle_rented", "License Plate": "license_plate", "VIN #": "vin",
      "Reason for Removal": "reason_for_removal", "Last Payment Date": "last_payment_date", Notes: "notes",
    },
  },
};

async function fetchAirtable(tableName) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    if (!res.ok) throw new Error(`Airtable ${tableName}: ${res.status} ${await res.text()}`);
    const json = await res.json();
    records.push(...json.records);
    offset = json.offset;
    await new Promise((r) => setTimeout(r, 220)); // ~5 req/s limit
  } while (offset);
  return records;
}

async function migrateTable(sbTable, def) {
  const rows = await fetchAirtable(def.airtableTable);
  const mapped = rows.map((rec) => {
    const out = { airtable_id: rec.id };
    for (const [atField, sbCol] of Object.entries(def.fields)) {
      out[sbCol] = coerce(rec.fields[atField]);
    }
    return out;
  });

  console.log(`\n${sbTable}  ← Airtable "${def.airtableTable}": ${mapped.length} records`);
  if (mapped[0]) console.log("  sample:", JSON.stringify(mapped[0]).slice(0, 240));

  if (!COMMIT) {
    console.log("  DRY-RUN — no write. Re-run with --commit to upsert.");
    return { table: sbTable, count: mapped.length, written: 0 };
  }

  let written = 0;
  for (let i = 0; i < mapped.length; i += 100) {
    const batch = mapped.slice(i, i + 100);
    const { error } = await supabase.from(sbTable).upsert(batch, { onConflict: "airtable_id" });
    if (error) { console.error(`  ✗ batch ${i}: ${error.message}`); break; }
    written += batch.length;
  }
  console.log(`  ✓ upserted ${written}/${mapped.length}`);
  return { table: sbTable, count: mapped.length, written };
}

(async () => {
  console.log(`Airtable base ${BASE_ID} → Supabase  | mode: ${COMMIT ? "COMMIT" : "DRY-RUN"}${ONLY ? ` | table=${ONLY}` : ""}`);
  const entries = Object.entries(TABLE_MAP).filter(([t]) => !ONLY || t === ONLY);
  if (!entries.length) { console.error(`No mapped table named "${ONLY}".`); process.exit(1); }
  const summary = [];
  for (const [sbTable, def] of entries) {
    try { summary.push(await migrateTable(sbTable, def)); }
    catch (e) { console.error(`✗ ${sbTable}: ${e.message}`); }
  }
  console.log("\n── summary ──");
  for (const s of summary) console.log(`  ${s.table}: ${s.count} read, ${s.written} written`);
  console.log(COMMIT ? "Done." : "\nDry-run complete. Add --commit when the mappings look right.");
})();
