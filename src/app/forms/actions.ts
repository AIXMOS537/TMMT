"use server";

import { z } from "zod";
import { createSSRClient } from "@/lib/supabase-server";

// ─── Shared helpers ──────────────────────────────

type FormResult = { success: true } | { success: false; error: string };

async function insertRow(table: string, record: Record<string, unknown>): Promise<FormResult> {
  const supabase = await createSSRClient();
  const { error } = await supabase.from(table).insert(record);
  if (error) {
    console.error(`[${table}] insert failed:`, error.message);
    return { success: false, error: "Submission failed. Please try again." };
  }
  return { success: true };
}

// ─── 1. Lead Intake ──────────────────────────────

const leadSchema = z.object({
  contact_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(254).or(z.literal("")),
  opportunity_name: z.string().max(500).optional(),
  priority_level: z.enum(["Urgent", "Moderate", "Requires Follow Up", ""]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function submitLeadIntake(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("incoming_leads", {
    contact_name: d.contact_name.trim(),
    phone: d.phone.replace(/\D/g, "") || null,
    email: d.email || null,
    opportunity_name: d.opportunity_name || null,
    priority_level: d.priority_level || null,
    notes: d.notes || null,
    status: "New Lead",
  });
}

// ─── 2. Appointment ──────────────────────────────

const appointmentSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(254).or(z.literal("")),
  appointment_type: z.enum(["Vehicle Pickup", "Vehicle Return", "Inspection", "Insurance Review", "Payment Discussion", "General Inquiry"]),
  appointment_date: z.string().min(1),
  appointment_time: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export async function submitAppointment(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = appointmentSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("appointments", {
    customer_name: d.customer_name.trim(),
    phone: d.phone,
    email: d.email || null,
    appointment_type: d.appointment_type,
    appointment_date: d.appointment_date,
    appointment_time: d.appointment_time,
    notes: d.notes || null,
    status: "Scheduled",
    created_at: new Date().toISOString(),
  });
}

// ─── 3. Background Check ─────────────────────────

const bgCheckSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone_number: z.string().min(7).max(20),
  email: z.string().email().max(254),
  own_insurance: z.enum(["Yes", "No"]),
  review_notes: z.string().max(2000).optional(),
});

export async function submitBackgroundCheck(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = bgCheckSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("background_checks", {
    customer_name: d.customer_name.trim(),
    phone_number: d.phone_number,
    email: d.email,
    own_insurance: d.own_insurance,
    review_notes: d.review_notes || null,
    background_check_status: "Pending",
    insurance_check_status: "Pending",
    earnings_verification_status: "Pending",
    verification_form_submitted: true,
  });
}

// ─── 4. Waitlist ─────────────────────────────────

const waitlistSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().min(7).max(20),
  customer_email: z.string().email().max(254).or(z.literal("")),
  vehicle_type: z.string().max(100).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.string().max(4).optional(),
  desired_weekly_payment: z.string().max(10).optional(),
  desired_specs_notes: z.string().max(2000).optional(),
});

export async function submitWaitlist(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("waitlist", {
    customer_name: d.customer_name.trim(),
    customer_phone: d.customer_phone,
    customer_email: d.customer_email || null,
    vehicle_type: d.vehicle_type || null,
    make: d.make || null,
    model: d.model || null,
    year: d.year ? Number(d.year) : null,
    desired_weekly_payment: d.desired_weekly_payment ? Number(d.desired_weekly_payment) : null,
    desired_specs_notes: d.desired_specs_notes || null,
    status: "Waiting",
    date_added: new Date().toISOString().split("T")[0],
  });
}

// ─── 5. Ticket ───────────────────────────────────

const ticketSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  vehicle_description: z.string().max(200).optional(),
  issue_type: z.enum(["Mechanical Issue", "Electrical Issue", "Body Damage", "Flat Tire", "Accident", "Locked Out", "Battery Dead", "Check Engine Light", "A/C or Heating", "Windshield/Glass", "Other"]),
  urgency: z.enum(["Low", "Medium", "High", "Emergency"]),
  description: z.string().min(1).max(5000),
  location: z.string().max(500).optional(),
});

export async function submitTicket(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = ticketSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("tickets", {
    customer_name: d.customer_name.trim(),
    phone: d.phone,
    vehicle_description: d.vehicle_description || null,
    issue_type: d.issue_type,
    urgency: d.urgency,
    description: d.description,
    location: d.location || null,
    status: "Open",
    created_at: new Date().toISOString(),
  });
}

// ─── 6. Inspection (Customer) ────────────────────

const inspectionSchema = z.object({
  full_name: z.string().min(1).max(200),
  odometer_reading: z.string().min(1),
  confirmation: z.literal("on"),
});

export async function submitInspection(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = inspectionSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and confirm the inspection." };

  const d = parsed.data;
  return insertRow("customer_inspection_photos", {
    full_name: d.full_name.trim(),
    odometer_reading: Number(d.odometer_reading),
    interior_clean: raw.interior_clean === "on",
    exterior_clean: raw.exterior_clean === "on",
    confirmation: true,
    date_time: new Date().toISOString(),
  });
}

// ─── 7. Handover ─────────────────────────────────

const handoverSchema = z.object({
  customer_name: z.string().min(1).max(200),
  staff_name: z.string().min(1).max(200),
  vehicle_make: z.string().max(100).optional(),
  vehicle_model: z.string().max(100).optional(),
  license_plate: z.string().max(20).optional(),
  odometer_reading: z.string().min(1),
  fuel_level: z.enum(["Empty", "1/4", "1/2", "3/4", "Full"]),
  condition_notes: z.string().max(2000).optional(),
  customer_signature: z.string().min(1).max(200),
  handover_type: z.enum(["Pickup", "Return"]),
});

export async function submitHandover(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = handoverSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;
  return insertRow("vehicle_handover", {
    customer_name: d.customer_name.trim(),
    staff_name: d.staff_name.trim(),
    vehicle_make: d.vehicle_make || null,
    vehicle_model: d.vehicle_model || null,
    license_plate: d.license_plate || null,
    odometer_reading: Number(d.odometer_reading),
    fuel_level: d.fuel_level,
    check_exterior: raw.check_exterior === "on",
    check_interior: raw.check_interior === "on",
    check_tires: raw.check_tires === "on",
    check_lights: raw.check_lights === "on",
    check_documents: raw.check_documents === "on",
    condition_notes: d.condition_notes || null,
    customer_signature: d.customer_signature.trim(),
    handover_type: d.handover_type,
    status: "Completed",
    handover_date: new Date().toISOString().split("T")[0],
  });
}

// ─── 8. Onboarding Inspection ────────────────────

const onboardingSchema = z.object({
  inspector_name: z.string().min(1).max(200),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.string().min(1).max(4),
  vin: z.string().min(1).max(50),
  license_plate: z.string().max(20).optional(),
  color: z.string().max(50).optional(),
  odometer: z.string().min(1),
  overall_rating: z.enum(["Fleet Ready", "Conditional", "Needs Work", "Rejected"]),
  notes: z.string().max(5000).optional(),
});

export async function submitOnboardingInspection(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check required fields and try again." };

  const d = parsed.data;

  // Build record with all fields from form
  const record: Record<string, unknown> = {
    inspector_name: d.inspector_name.trim(),
    make: d.make.trim(),
    model: d.model.trim(),
    year: d.year,
    vin: d.vin.trim(),
    license_plate: d.license_plate || null,
    color: d.color || null,
    odometer: Number(d.odometer),
    overall_rating: d.overall_rating,
    notes: d.notes || null,
    status: "Completed",
    inspection_date: new Date().toISOString().split("T")[0],
  };

  // Copy remaining fields (condition ratings, tire pressures, etc.)
  const numericFields = ["tire_pressure_fl", "tire_pressure_fr", "tire_pressure_rl", "tire_pressure_rr"];
  const skipFields = new Set(["inspector_name", "make", "model", "year", "vin", "license_plate", "color", "odometer", "overall_rating", "notes"]);

  for (const [k, v] of Object.entries(raw)) {
    if (skipFields.has(k) || !v) continue;
    record[k] = numericFields.includes(k) ? Number(v) : v;
  }

  return insertRow("vehicle_onboarding_inspections", record);
}
