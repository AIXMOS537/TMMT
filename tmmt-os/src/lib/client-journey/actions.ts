"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import {
  PATH_B_BALANCE_CENTS,
  PATH_B_DOWN_CENTS,
  PATH_C_MENTORSHIP_CENTS,
  PAYMENT_PLAN_WINDOW_DAYS,
  canAddBasePath,
  canAddMentorship,
} from "./credit-paths";
import { getOrCreateJourney } from "./queries";
import type { BaseCreditPath } from "./types";
import { recomputeJourneyForEmail } from "./recompute";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  OPERATOR_REVENUE_SHARE,
  RUBRIC_CATEGORIES,
  RUBRIC_CATEGORY_MAX,
  type OperatorLevel,
  type RubricCategory,
} from "./types";
import {
  operatorGhlStageForScore,
  syncJourneyCreditTag,
  syncLtoInProgressTag,
  syncLtoEligibleTag,
  syncOperatorToGhl,
} from "./ghl-journey-sync";
import { fetchPartnerSplitConfigForEmail } from "@/lib/revenue-split/queries";
import { resolvePartnerSplit } from "@/lib/revenue-split/resolve";
import { splitGrossCents } from "@/lib/revenue-split/calculate";

export async function acknowledgeEducationSectionAction(sectionId: string) {
  const me = await getCurrentUser();
  if (!me?.id || !me.email) throw new Error("Not signed in");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("credit_education_acknowledgments").upsert(
    { profile_id: me.id, section_id: sectionId },
    { onConflict: "profile_id,section_id" }
  );
  if (error) throw error;

  try {
    const service = createSupabaseServiceClient();
    await service.rpc("recompute_journey", { p_email: me.email.trim().toLowerCase() });
  } catch {
    // migration may not be applied yet
  }

  revalidatePath("/client/credit");
  revalidatePath("/client/path");
}

export async function updateTrainingProgressAction(moduleId: string, percent: number) {
  const me = await getCurrentUser();
  if (!me?.id || !me.email) throw new Error("Not signed in");

  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("training_module_progress").upsert(
    {
      profile_id: me.id,
      module_id: moduleId,
      percent_complete: pct,
      completed_at: pct >= 100 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,module_id" }
  );
  if (error) throw error;

  try {
    const service = createSupabaseServiceClient();
    await service.rpc("recompute_journey", { p_email: me.email.trim().toLowerCase() });
  } catch {
    // ignore if RPC missing
  }

  revalidatePath("/client/training");
  revalidatePath("/client/path");
}

export async function assignCreditBasePathAction(email: string, path: BaseCreditPath) {
  await requireRole(["admin", "internal_team"]);
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();

  const journey = await getOrCreateJourney(normalized, supabase);
  if (!journey) throw new Error("Could not create journey");

  const { data: plans } = await supabase
    .from("credit_billing_plans")
    .select("id, credit_path, status, is_add_on, amount_cents, monthly_fee_cents, next_billing_at, due_at, paid_at")
    .eq("journey_id", journey.id);

  if (!canAddBasePath((plans ?? []) as Parameters<typeof canAddBasePath>[0], path)) {
    throw new Error("Client already has an active base credit path. Cancel or complete it first.");
  }

  const { data: enrollment, error: enrollErr } = await supabase
    .from("credit_enrollments")
    .insert({
      journey_id: journey.id,
      customer_email: normalized,
      status: "active",
      delivery_mode: "self_guided_training",
    })
    .select("id")
    .single();
  if (enrollErr) throw enrollErr;

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + PAYMENT_PLAN_WINDOW_DAYS);

  if (path === "monthly_97") {
    const { error } = await supabase.from("credit_billing_plans").insert({
      enrollment_id: enrollment.id,
      journey_id: journey.id,
      credit_path: "monthly_97",
      status: "active",
      is_add_on: false,
      delivery_mode: "self_guided_training",
      amount_cents: 9700,
      monthly_fee_cents: 9700,
      next_billing_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    if (error) throw error;

    await supabase.from("rental_ledger").insert({
      customer_email: normalized,
      entry_type: "payment",
      status: "pending",
      title: "Credit enrollment — monthly (up to $97)",
      amount_cents: 9700,
      due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      metadata: { credit_path: "monthly_97", journey_id: journey.id },
      visible_to_client: true,
    });
  } else {
    const { data: plan, error } = await supabase
      .from("credit_billing_plans")
      .insert({
        enrollment_id: enrollment.id,
        journey_id: journey.id,
        credit_path: "payment_plan_500",
        status: "active",
        is_add_on: false,
        delivery_mode: "self_guided_training",
        amount_cents: PATH_B_DOWN_CENTS + PATH_B_BALANCE_CENTS,
        down_paid_cents: 0,
        balance_due_cents: PATH_B_BALANCE_CENTS,
        due_at: dueAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("rental_ledger").insert([
      {
        customer_email: normalized,
        entry_type: "payment",
        status: "pending",
        title: "Credit plan — $250 down",
        amount_cents: PATH_B_DOWN_CENTS,
        due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        metadata: { credit_path: "payment_plan_500", installment: "down", journey_id: journey.id },
        visible_to_client: true,
      },
      {
        customer_email: normalized,
        entry_type: "payment",
        status: "pending",
        title: "Credit plan — $250 balance",
        amount_cents: PATH_B_BALANCE_CENTS,
        due_at: dueAt.toISOString(),
        metadata: { credit_path: "payment_plan_500", installment: "balance", journey_id: journey.id },
        visible_to_client: true,
      },
    ]);

    await supabase.from("credit_payment_schedule").insert([
      {
        plan_id: plan.id,
        installment_no: 1,
        amount_cents: PATH_B_DOWN_CENTS,
        due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
      {
        plan_id: plan.id,
        installment_no: 2,
        amount_cents: PATH_B_BALANCE_CENTS,
        due_at: dueAt.toISOString(),
      },
    ]);
  }

  try {
    await syncJourneyCreditTag(normalized, path);
  } catch {
    // GHL optional — do not block staff assignment
  }

  await recomputeJourneyForEmail(normalized);
  revalidatePath(`/internal/journey/${encodeURIComponent(normalized)}`);
  revalidatePath("/client/credit");
}

export async function assignMentorshipDfyAction(email: string) {
  await requireRole(["admin", "internal_team"]);
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();
  const journey = await getOrCreateJourney(normalized, supabase);
  if (!journey) throw new Error("Journey not found");

  const { data: plans } = await supabase
    .from("credit_billing_plans")
    .select("id, credit_path, status, is_add_on, amount_cents, monthly_fee_cents, next_billing_at, due_at, paid_at")
    .eq("journey_id", journey.id);

  if (!canAddMentorship((plans ?? []) as Parameters<typeof canAddMentorship>[0])) {
    throw new Error("Base credit path must be satisfied before adding mentorship DFY.");
  }

  const { data: enrollment } = await supabase
    .from("credit_enrollments")
    .select("id")
    .eq("journey_id", journey.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const enrollId =
    enrollment?.id ??
    (
      await supabase
        .from("credit_enrollments")
        .insert({
          journey_id: journey.id,
          customer_email: normalized,
          status: "active",
          delivery_mode: "done_for_you",
        })
        .select("id")
        .single()
    ).data?.id;

  if (!enrollId) throw new Error("Enrollment required");

  await supabase.from("credit_billing_plans").insert({
    enrollment_id: enrollId,
    journey_id: journey.id,
    credit_path: "mentorship_dfy_1000",
    status: "active",
    is_add_on: true,
    delivery_mode: "done_for_you",
    amount_cents: PATH_C_MENTORSHIP_CENTS,
  });

  await supabase.from("rental_ledger").insert({
    customer_email: normalized,
    entry_type: "payment",
    status: "pending",
    title: "Mentorship — Done for you ($1,000)",
    amount_cents: PATH_C_MENTORSHIP_CENTS,
    metadata: { credit_path: "mentorship_dfy_1000", journey_id: journey.id },
    visible_to_client: true,
  });

  await recomputeJourneyForEmail(normalized);
  revalidatePath(`/internal/journey/${encodeURIComponent(normalized)}`);
}

export async function saveOperatorRubricAction(
  email: string,
  scores: Record<string, number>,
  periodMonth: string
) {
  await requireRole(["admin", "internal_team"]);
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();
  const me = await getCurrentUser();

  const total = RUBRIC_CATEGORIES.reduce((sum, cat) => {
    const raw = scores[cat] ?? 0;
    const max = RUBRIC_CATEGORY_MAX[cat as RubricCategory];
    return sum + Math.min(max, Math.max(0, raw));
  }, 0);
  const clamped = Math.min(100, Math.max(0, total));

  let level: OperatorLevel = "candidate";
  if (clamped >= 85) level = "master";
  else if (clamped >= 75) level = "senior";
  else if (clamped >= 70) level = "certified";

  const journey = await getOrCreateJourney(normalized, supabase);

  const { data: existingOp } = await supabase
    .from("operator_profiles")
    .select("id")
    .ilike("customer_email", normalized)
    .maybeSingle();

  const opPayload = {
    journey_id: journey?.id,
    customer_email: normalized,
    rubric_score: clamped,
    level,
    revenue_share_pct: OPERATOR_REVENUE_SHARE[level],
  };

  const { data: op, error: opErr } = existingOp
    ? await supabase
        .from("operator_profiles")
        .update(opPayload)
        .eq("id", existingOp.id)
        .select("id")
        .single()
    : await supabase.from("operator_profiles").insert(opPayload).select("id").single();
  if (opErr) throw opErr;

  await supabase.from("operator_rubric_scores").upsert(
    {
      operator_id: op.id,
      period_month: periodMonth,
      category_scores: scores,
      total_score: clamped,
      scored_by: me?.id ?? null,
    },
    { onConflict: "operator_id,period_month" }
  );

  const ghlStage = operatorGhlStageForScore(clamped, level);

  await supabase
    .from("operator_profiles")
    .update({ ghl_pipeline_stage: ghlStage })
    .eq("id", op.id);

  if (journey && clamped >= 70) {
    await supabase
      .from("client_journey")
      .update({ program_track: "operator_candidate" })
      .eq("id", journey.id);
  } else if (journey && clamped < 70) {
    await supabase
      .from("client_journey")
      .update({ program_track: "client" })
      .eq("id", journey.id)
      .eq("program_track", "operator_candidate");
  }

  const service = createSupabaseServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id && clamped >= 70) {
    await service.from("profile_entitlement_grants").upsert(
      {
        profile_id: profile.id,
        entitlement_slug: "operator_candidate",
        granted_by: me?.id ?? null,
        note: `Operator rubric ${clamped}/100`,
      },
      { onConflict: "profile_id,entitlement_slug" }
    );
  }

  if (profile?.id && clamped < 70) {
    await service
      .from("profile_entitlement_grants")
      .delete()
      .eq("profile_id", profile.id)
      .eq("entitlement_slug", "operator_candidate");
  }

  try {
    await syncOperatorToGhl(normalized, ghlStage, clamped);
  } catch {
    // GHL optional
  }

  revalidatePath("/internal/operators");
  revalidatePath(`/internal/journey/${encodeURIComponent(normalized)}`);
}

export async function markPaymentPlanCompleteAction(email: string) {
  await requireRole(["admin", "internal_team"]);
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();
  const journey = await getOrCreateJourney(normalized, supabase);
  if (!journey) throw new Error("Journey not found");

  await supabase
    .from("credit_billing_plans")
    .update({ status: "completed", paid_at: new Date().toISOString() })
    .eq("journey_id", journey.id)
    .eq("credit_path", "payment_plan_500")
    .eq("is_add_on", false);

  await recomputeJourneyForEmail(normalized);
  revalidatePath(`/internal/journey/${encodeURIComponent(normalized)}`);
}

export async function createLtoAgreementAction(email: string, vin?: string) {
  await requireRole(["admin", "internal_team"]);
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();
  const journey = await getOrCreateJourney(normalized, supabase);
  if (!journey) throw new Error("Journey not found");

  const { data: ltoRow, error: ltoErr } = await supabase
    .from("lto_agreements")
    .insert({
      journey_id: journey.id,
      vin: vin?.trim() || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (ltoErr) throw ltoErr;

  await supabase.from("contract_instances").insert({
    journey_id: journey.id,
    contract_type: "lto_purchase_agreement",
    title: vin ? `Lease-to-own — ${vin}` : "Lease-to-own agreement",
    status: "pending",
    metadata: { lto_agreement_id: ltoRow.id },
  });

  if (journey.lto_eligible) {
    try {
      await syncLtoEligibleTag(normalized);
    } catch {
      // optional
    }
  }
  try {
    await syncLtoInProgressTag(normalized);
  } catch {
    // optional
  }

  await recomputeJourneyForEmail(normalized);
  revalidatePath(`/internal/journey/${encodeURIComponent(normalized)}`);
  revalidatePath("/client/documents");
}

export async function recordVehicleTurnoverAction(email: string, notes?: string) {
  await requireRole(["admin", "internal_team"]);
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();
  const journey = await getOrCreateJourney(normalized, supabase);
  if (!journey) throw new Error("Journey not found");

  await supabase.from("vehicle_events").insert({
    journey_id: journey.id,
    event_type: "turnover",
    notes: notes?.trim() || null,
  });

  await supabase.from("contract_instances").insert({
    journey_id: journey.id,
    contract_type: "vehicle_turnover",
    title: "Vehicle turnover",
    status: "pending",
  });

  await supabase.from("journey_checkpoint_events").upsert(
    {
      journey_id: journey.id,
      checkpoint_slug: "vehicle_turnover_complete",
      evidence: { source: "staff_action" },
    },
    { onConflict: "journey_id,checkpoint_slug" }
  );

  await recomputeJourneyForEmail(normalized);
  revalidatePath(`/internal/journey/${encodeURIComponent(normalized)}`);
  revalidatePath("/client/documents");
}

export async function recordRevenueSplitAction(
  email: string,
  grossCents: number,
  periodStart: string,
  periodEnd: string
) {
  await requireRole(["admin", "internal_team"]);
  const normalized = email.trim().toLowerCase();
  const supabase = createSupabaseServerClient();

  const { config, organizationId } = await fetchPartnerSplitConfigForEmail(normalized);
  const partnerSplit = resolvePartnerSplit(
    config,
    organizationId ? "organization" : "journey"
  );

  const { data: op } = await supabase
    .from("operator_profiles")
    .select("id, level, revenue_share_pct")
    .ilike("customer_email", normalized)
    .maybeSingle();

  const gross = Math.max(0, Math.round(grossCents));
  const metadata: Record<string, unknown> = {};

  let platformPct: number;
  let platformCents: number;
  let operatorCents: number;
  let partnerCents: number | null = null;
  let agencyCents: number | null = null;
  let partnerPct: number | null = null;
  let agencyPct: number | null = null;

  if (partnerSplit) {
    const amounts = splitGrossCents(gross, partnerSplit);
    partnerPct = amounts.partnerPct;
    agencyPct = amounts.agencyPct;
    partnerCents = amounts.partnerCents;
    agencyCents = amounts.agencyCents;
    platformPct = amounts.agencyPct;
    platformCents = amounts.agencyCents;
    operatorCents = amounts.partnerCents;
    metadata.split_source = partnerSplit.source;
    metadata.split_tier = partnerSplit.tier;
    metadata.split_segment = partnerSplit.segment;
    metadata.partner_pct = partnerSplit.partnerPct;
    metadata.agency_pct = partnerSplit.agencyPct;
  } else if (op) {
    platformPct = op.revenue_share_pct ?? 35;
    platformCents = Math.round((gross * platformPct) / 100);
    operatorCents = gross - platformCents;
    metadata.level = op.level;
    metadata.platform_pct = platformPct;
    metadata.split_source = "operator_fallback";
  } else {
    throw new Error(
      "Set partner revenue split on the client org (Agency page) or save operator rubric first."
    );
  }

  if (op) metadata.level = op.level;

  const row: Record<string, unknown> = {
    period_start: periodStart,
    period_end: periodEnd,
    gross_cents: gross,
    platform_cents: platformCents,
    operator_cents: operatorCents,
    partner_cents: partnerCents,
    agency_cents: agencyCents,
    partner_pct: partnerPct,
    agency_pct: agencyPct,
    split_tier: partnerSplit?.tier ?? null,
    split_segment: partnerSplit?.segment ?? null,
    organization_id: organizationId,
    status: "pending",
    metadata,
  };
  if (op?.id) row.operator_id = op.id;

  const { error } = await supabase.from("revenue_splits").insert(row);
  if (error) throw error;

  revalidatePath("/internal/operators");
  revalidatePath("/internal/agency");
  revalidatePath(`/internal/journey/${encodeURIComponent(normalized)}`);
}
