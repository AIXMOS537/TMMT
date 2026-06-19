"use server";

import { z } from "zod";
import { createSSRClient } from "@/lib/supabase-server";
import { fanOut } from "@/lib/notify";

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

const attributionSchema = z.object({
  source: z.string().max(60).optional(),
  source_campaign: z.string().max(200).optional(),
  source_medium: z.string().max(60).optional(),
  referrer_url: z.string().max(2000).optional(),
  landing_url: z.string().max(2000).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
});

const leadSchema = z.object({
  contact_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(254).or(z.literal("")),
  opportunity_name: z.string().max(500).optional(),
  priority_level: z.enum(["Urgent", "Moderate", "Requires Follow Up", ""]).optional(),
  notes: z.string().max(2000).optional(),
}).merge(attributionSchema);

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
    source: d.source || null,
    source_campaign: d.source_campaign || null,
    source_medium: d.source_medium || null,
    referrer_url: d.referrer_url || null,
    landing_url: d.landing_url || null,
    utm_source: d.utm_source || null,
    utm_medium: d.utm_medium || null,
    utm_campaign: d.utm_campaign || null,
    utm_content: d.utm_content || null,
    utm_term: d.utm_term || null,
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

// ─── 9. Credit & Funding Intake (Phase 9) ────────
// Spec: CREDIT_FUNDING_OS.md
// Educational-only. Never store hard credit scores, SSNs, or DOBs.

const BANNED_TERMS = [
  "guaranteed approval",
  "guarantee approval",
  "guaranteed funding",
  "instant funding",
  "credit repair",
  "we will get you approved",
  "we will raise your score",
];

function containsBannedTerm(...parts: Array<string | undefined | null>): boolean {
  const haystack = parts.filter(Boolean).join(" ").toLowerCase();
  return BANNED_TERMS.some((t) => haystack.includes(t));
}

const scoreField = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().min(0).max(10).optional()
);

const creditFundingSchema = z.object({
  // Stage 1
  first_name: z.string().max(120).optional(),
  preferred_channel: z.enum(["sms", "email", "in_app", ""]).optional(),
  goals_horizon: z.string().max(1000).optional(),
  personal_vs_business_focus: z.enum(["personal", "business", "both", ""]).optional(),
  top_friction: z.string().max(1000).optional(),
  // Stage 2
  entity_type: z.enum(["none", "sole_prop", "llc", "s_corp", "c_corp", "partnership", ""]).optional(),
  years_in_business: z.string().max(4).optional(),
  revenue_range: z.enum(["none", "<50k", "50k-250k", "250k-1m", ">1m", ""]).optional(),
  team_size: z.enum(["just_me", "2-5", "6-20", "20+", ""]).optional(),
  industry: z.string().max(200).optional(),
  // Stage 3
  funding_goal_type: z.enum(["growth", "equipment", "working_capital", "real_estate", "refinance", "other", ""]).optional(),
  prior_funding_history: z.enum(["none", "applied_no_approval", "approved_completed", "currently_servicing", ""]).optional(),
  time_horizon: z.enum(["immediate", "near", "planning", "exploring", ""]).optional(),
  readiness_indicators: z.string().max(2000).optional(),
  // Stage 4 (self-reported only — buckets, not numbers)
  awareness_level: z.enum(["unaware", "vaguely_aware", "monitors_regularly", "actively_managing", ""]).optional(),
  self_reported_score_range: z.enum(["<580", "580-619", "620-679", "680-739", "740+", "unknown", ""]).optional(),
  existing_challenges: z.string().max(2000).optional(),
  prior_education_or_program: z.enum(["none", "generic_app", "paid_program", "professional_advisor", ""]).optional(),
  // Stage 5
  banking_status: z.enum(["none", "personal_only", "separate_business_account", "multiple_business_accounts", ""]).optional(),
  entity_standing: z.enum(["not_registered", "registered", "registered_and_in_good_standing", "unknown", ""]).optional(),
  web_presence: z.enum(["none", "social_only", "landing_page", "full_site", ""]).optional(),
  bookkeeping: z.enum(["none", "spreadsheets", "accounting_software", "bookkeeper", "cpa", ""]).optional(),
  documentation: z.enum(["none", "partial", "organized_last_12mo", "organized_24mo+", ""]).optional(),
  // Stage 6 — readiness scores
  score_business_foundation: scoreField,
  score_banking_readiness: scoreField,
  score_financial_organization: scoreField,
  score_credit_awareness: scoreField,
  score_revenue_stability: scoreField,
  score_funding_readiness: scoreField,
  // Compliance + meta
  ai_disclaimer_shown: z.string().optional(),
  credit_guidance_disclaimer_linked: z.string().optional(),
  stage_reached: z.string().max(1).optional(),
  channel: z.string().max(40).optional(),
  operator_handoff_requested: z.string().optional(),
});

function splitToJsonArray(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(/\r?\n|;|,/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function routingTierFor(total: number): "education" | "guidance" | "pre_referral" | "introduction" {
  if (total >= 50) return "introduction";
  if (total >= 35) return "pre_referral";
  if (total >= 20) return "guidance";
  return "education";
}

export async function submitCreditFundingIntake(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = creditFundingSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Please check your entries and try again." };

  const d = parsed.data;

  // Compliance guardrail — block any free-text input containing banned terms before write.
  if (containsBannedTerm(d.goals_horizon, d.top_friction, d.industry, d.readiness_indicators, d.existing_challenges)) {
    console.warn("[credit_funding_sessions] banned-term submission blocked");
    return { success: false, error: "We can't accept that wording. We're educational only — no approval or score guarantees. Please rephrase." };
  }

  const scoreParts = [
    d.score_business_foundation ?? 0,
    d.score_banking_readiness ?? 0,
    d.score_financial_organization ?? 0,
    d.score_credit_awareness ?? 0,
    d.score_revenue_stability ?? 0,
    d.score_funding_readiness ?? 0,
  ];
  const scoreTotal = scoreParts.reduce((a, b) => a + b, 0);
  const startedAt = new Date().toISOString();
  const handoffRequested =
    d.operator_handoff_requested === "on" || d.operator_handoff_requested === "true";
  const tier = routingTierFor(scoreTotal);

  const result = await insertRow("credit_funding_sessions", {
    first_name: d.first_name?.trim() || null,
    preferred_channel: d.preferred_channel || null,
    goals_horizon: d.goals_horizon || null,
    personal_vs_business_focus: d.personal_vs_business_focus || null,
    top_friction: d.top_friction || null,

    entity_type: d.entity_type || null,
    years_in_business: d.years_in_business ? Number(d.years_in_business) : null,
    revenue_range: d.revenue_range || null,
    team_size: d.team_size || null,
    industry: d.industry?.trim() || null,

    funding_goal_type: d.funding_goal_type || null,
    prior_funding_history: d.prior_funding_history || null,
    time_horizon: d.time_horizon || null,
    readiness_indicators: splitToJsonArray(d.readiness_indicators),

    awareness_level: d.awareness_level || null,
    self_reported_score_range: d.self_reported_score_range || null,
    existing_challenges: splitToJsonArray(d.existing_challenges),
    prior_education_or_program: d.prior_education_or_program || null,

    banking_status: d.banking_status || null,
    entity_standing: d.entity_standing || null,
    web_presence: d.web_presence || null,
    bookkeeping: d.bookkeeping || null,
    documentation: d.documentation || null,

    score_business_foundation: d.score_business_foundation ?? 0,
    score_banking_readiness: d.score_banking_readiness ?? 0,
    score_financial_organization: d.score_financial_organization ?? 0,
    score_credit_awareness: d.score_credit_awareness ?? 0,
    score_revenue_stability: d.score_revenue_stability ?? 0,
    score_funding_readiness: d.score_funding_readiness ?? 0,

    recommended_actions: [],

    ai_disclaimer_shown: d.ai_disclaimer_shown === "on" || d.ai_disclaimer_shown === "true",
    credit_guidance_disclaimer_linked:
      d.credit_guidance_disclaimer_linked === "on" || d.credit_guidance_disclaimer_linked === "true",
    no_outcome_promised: true,
    banned_terms_check_passed: true,

    started_at: startedAt,
    completed_at: startedAt,
    stage_reached: d.stage_reached ? Number(d.stage_reached) : 6,
    channel: d.channel || "web_form",
    operator_handoff_requested: handoffRequested,
    routing_tier: tier,
  });

  // Fan out a notification to Slack + iMessage when the user asks for human follow-up.
  // Fire-and-forget on the wire; failures are logged but never block the form response.
  if (result.success && handoffRequested) {
    const name = d.first_name?.trim() || "Anonymous";
    const industry = d.industry?.trim() ? ` · ${d.industry.trim()}` : "";
    const goal = d.funding_goal_type ? ` · goal: ${d.funding_goal_type}` : "";
    const horizon = d.time_horizon ? ` · ${d.time_horizon}` : "";
    const text =
      `Credit/Funding handoff requested\n` +
      `${name}${industry}${goal}${horizon}\n` +
      `Tier: ${tier} · Readiness: ${scoreTotal}/60\n` +
      `Review: https://tmmt-ops.vercel.app/credit-funding`;
    fanOut(text).catch((err) => {
      console.warn("[credit_funding_sessions] fanOut error:", err);
    });
  }

  return result;
}

// ─── 10. Team Onboarding (the "easy as 1-2-3" link) ──────────────
// Public link a teammate taps on phone or laptop. No Terminal, no files.
// Mirrors the lead-intake public-form pattern; pings the owner on submit.

const teamOnboardingSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(25),
  email: z.string().email().max(254).or(z.literal("")).optional(),
  role: z.enum(["operator", "developer", "vendor", "teammate", "owner", ""]).optional(),
  owns: z.string().max(1000).optional(),
  skills: z.string().max(1000).optional(),
  first_step: z.string().max(1000).optional(),
  mission_accepted: z.literal("on"),
  confidentiality_agreed: z.literal("on"),
  device: z.string().max(500).optional(),
});

export async function submitTeamOnboarding(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = teamOnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Please add your name and phone, and check both boxes." };
  }

  const d = parsed.data;
  const role = d.role || "operator";

  const result = await insertRow("team_onboarding", {
    full_name: d.full_name.trim(),
    phone: d.phone.replace(/[^\d+]/g, "") || null,
    email: d.email || null,
    role,
    owns: d.owns?.trim() || null,
    skills: d.skills?.trim() || null,
    first_step: d.first_step?.trim() || null,
    mission_accepted: true,
    confidentiality_agreed: true,
    device: d.device?.trim() || null,
    source: "web_link",
    status: "Pending Review",
  });

  // Ping the owner the moment someone joins. Fire-and-forget — never blocks the reply.
  if (result.success) {
    const text =
      `🤝 New teammate onboarded\n` +
      `${d.full_name.trim()} · ${role}\n` +
      `📱 ${d.phone}` +
      (d.email ? ` · ${d.email}` : "") +
      (d.first_step?.trim() ? `\nFirst step: ${d.first_step.trim()}` : "") +
      `\nReview & grant access in TMMT Ops.`;
    fanOut(text).catch((err) => {
      console.warn("[team_onboarding] fanOut error:", err);
    });
  }

  return result;
}

// ─── 11. Dealer Application (the /apply front door + qualification gate) ──────
// A dealer applies to deploy the empire (TMMT + AIXMOS + Moe Legacy) at their lot.
// The "bouncer": the three non-negotiables (licensed, real lot, plays fair) plus
// both agreements are REQUIRED — you cannot submit without them.

const dealerApplicationSchema = z.object({
  dealership_name: z.string().min(1).max(200),
  owner_name: z.string().min(1).max(200),
  phone: z.string().min(7).max(25),
  email: z.string().email().max(254).or(z.literal("")).optional(),
  city_state: z.string().max(200).optional(),
  // the gate — all required "on"
  licensed_dealer: z.literal("on"),
  has_real_lot: z.literal("on"),
  plays_fair: z.literal("on"),
  mission_accepted: z.literal("on"),
  confidentiality_agreed: z.literal("on"),
  // judgment info
  license_number: z.string().max(100).optional(),
  years_in_business: z.string().max(20).optional(),
  units_on_lot: z.string().max(20).optional(),
  biggest_struggle: z.string().max(2000).optional(),
  interested_tier: z.enum(["downtime_engine", "multi_lane", "flagship", ""]).optional(),
  device: z.string().max(500).optional(),
});

export async function submitDealerApplication(formData: FormData): Promise<FormResult> {
  const raw = Object.fromEntries(formData);
  const parsed = dealerApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "To apply you must be a licensed dealer with a real lot, agree to play fair, and accept the mission. Please check every box.",
    };
  }

  const d = parsed.data;

  // The bouncer: hard non-negotiables already enforced by the schema. `qualifies`
  // additionally weighs the soft signal (time in business) for the owner's at-a-glance review.
  const years = Number(d.years_in_business ?? "");
  const meetsTimeFloor = Number.isFinite(years) ? years >= 1 : true; // unknown → let owner judge
  const qualifies = meetsTimeFloor;

  const result = await insertRow("dealer_applications", {
    dealership_name: d.dealership_name.trim(),
    owner_name: d.owner_name.trim(),
    phone: d.phone.replace(/[^\d+]/g, "") || null,
    email: d.email || null,
    city_state: d.city_state?.trim() || null,
    licensed_dealer: true,
    has_real_lot: true,
    plays_fair: true,
    mission_accepted: true,
    confidentiality_agreed: true,
    license_number: d.license_number?.trim() || null,
    years_in_business: d.years_in_business?.trim() || null,
    units_on_lot: d.units_on_lot?.trim() || null,
    biggest_struggle: d.biggest_struggle?.trim() || null,
    interested_tier: d.interested_tier || null,
    qualifies,
    device: d.device?.trim() || null,
    source: "apply_link",
    status: "New Application",
  });

  if (result.success) {
    const flag = qualifies ? "✅ QUALIFIES" : "⚠️ REVIEW (under 1yr / unknown)";
    const tierLabel: Record<string, string> = {
      downtime_engine: "Downtime Engine",
      multi_lane: "Multi-Lane",
      flagship: "Flagship",
    };
    const tier = d.interested_tier ? ` · wants: ${tierLabel[d.interested_tier] ?? d.interested_tier}` : "";
    const where = d.city_state?.trim() ? ` · ${d.city_state.trim()}` : "";
    const text =
      `🏁 New DEALER application — ${flag}\n` +
      `${d.dealership_name.trim()} (${d.owner_name.trim()})${where}\n` +
      `📱 ${d.phone}` +
      (d.email ? ` · ${d.email}` : "") +
      (d.units_on_lot?.trim() ? ` · ${d.units_on_lot.trim()} units` : "") +
      (d.years_in_business?.trim() ? ` · ${d.years_in_business.trim()}yr` : "") +
      tier +
      (d.biggest_struggle?.trim() ? `\nStruggle: ${d.biggest_struggle.trim().slice(0, 240)}` : "") +
      `\nReview in TMMT Ops.`;
    fanOut(text).catch((err) => {
      console.warn("[dealer_applications] fanOut error:", err);
    });
  }

  return result;
}
