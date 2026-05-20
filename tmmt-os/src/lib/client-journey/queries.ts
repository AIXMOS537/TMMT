import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CreditBillingPlan, JourneyHub } from "./types";
import { basePathSatisfied } from "./credit-paths";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

export async function getOrCreateJourney(email: string, db?: Db) {
  const supabase = db ?? createSupabaseServerClient();
  const normalized = email.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("client_journey")
    .select("*")
    .ilike("customer_email", normalized)
    .maybeSingle();

  if (existing) return existing;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  const { data: created } = await supabase
    .from("client_journey")
    .insert({
      customer_email: normalized,
      profile_id: profile?.id ?? null,
    })
    .select("*")
    .single();

  return created;
}

export async function getJourneyHub(
  email: string,
  profileId?: string | null,
  db?: Db
): Promise<JourneyHub> {
  const supabase = db ?? createSupabaseServerClient();
  const normalized = email.trim().toLowerCase();

  const journey = await getOrCreateJourney(normalized, supabase);

  const [
    { data: checkpointEvents },
    { data: creditPlans },
    { data: eduSections },
    { data: acks },
    { data: modules },
    { data: progress },
    { data: ltoAgreements },
    { data: operator },
    { data: checkpoints },
  ] = await Promise.all([
    journey
      ? supabase
          .from("journey_checkpoint_events")
          .select("checkpoint_slug, met_at")
          .eq("journey_id", journey.id)
      : Promise.resolve({ data: [] }),
    journey
      ? supabase
          .from("credit_billing_plans")
          .select(
            "id, credit_path, status, is_add_on, amount_cents, monthly_fee_cents, next_billing_at, due_at, paid_at"
          )
          .eq("journey_id", journey.id)
      : Promise.resolve({ data: [] }),
    supabase.from("credit_education_sections").select("id, title, body_md").eq("active", true).order("sort_order"),
    profileId
      ? supabase
          .from("credit_education_acknowledgments")
          .select("section_id")
          .eq("profile_id", profileId)
      : Promise.resolve({ data: [] }),
    supabase.from("training_modules").select("*").eq("active", true).order("sort_order"),
    profileId
      ? supabase
          .from("training_module_progress")
          .select("module_id, percent_complete, completed_at")
          .eq("profile_id", profileId)
      : Promise.resolve({ data: [] }),
    journey
      ? supabase.from("lto_agreements").select("id, status, vin").eq("journey_id", journey.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("operator_profiles")
      .select("level, rubric_score, revenue_share_pct")
      .ilike("customer_email", normalized)
      .maybeSingle(),
    supabase.from("journey_checkpoints").select("slug, title").eq("active", true).order("sort_order"),
  ]);

  const ackSet = new Set((acks ?? []).map((a) => a.section_id));
  const sections = (eduSections ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    body_md: s.body_md,
    acknowledged: ackSet.has(s.id),
  }));
  const allAcknowledged = sections.length > 0 && sections.every((s) => s.acknowledged);

  const progressMap = new Map(
    (progress ?? []).map((p) => [p.module_id, { percent: p.percent_complete, completed_at: p.completed_at }])
  );

  const coreModules = (modules ?? []).filter((m) => m.is_core);
  const trainingModules = (modules ?? []).map((m) => {
    const prog = progressMap.get(m.id);
    return {
      id: m.id,
      slug: m.slug,
      title: m.title,
      summary: m.summary,
      is_core: m.is_core,
      percent_complete: prog?.percent ?? 0,
      completed_at: prog?.completed_at ?? null,
    };
  });

  const coreDone = coreModules.filter((m) => {
    const prog = progressMap.get(m.id);
    return prog && prog.percent >= 100 && prog.completed_at;
  }).length;
  const coreTotal = coreModules.length;
  const coreComplete = coreTotal > 0 && coreDone >= coreTotal;

  const metMap = new Map((checkpointEvents ?? []).map((e) => [e.checkpoint_slug, e.met_at]));
  const checkpointList = (checkpoints ?? []).map((c) => ({
    slug: c.slug,
    title: c.title,
    met_at: metMap.get(c.slug) ?? null,
  }));

  const plans = (creditPlans ?? []) as CreditBillingPlan[];
  const day90 = Boolean(metMap.get("day_90_good_standing"));

  return {
    journey: journey as JourneyHub["journey"],
    checkpoints: checkpointList,
    creditPlans: plans,
    education: { sections, allAcknowledged },
    training: {
      modules: trainingModules,
      coreComplete,
      coreDone,
      coreTotal,
    },
    lto: {
      eligible: journey?.lto_eligible ?? false,
      agreements: ltoAgreements ?? [],
    },
    operator: {
      profile: operator ?? null,
      candidateUnlocked: (operator?.rubric_score ?? 0) >= 60,
    },
    gates: {
      basePathSatisfied: basePathSatisfied(plans),
      educationComplete: allAcknowledged,
      trainingComplete: coreComplete,
      day90GoodStanding: day90,
    },
  };
}

export async function getJourneyByEmailForStaff(email: string) {
  return getJourneyHub(email.trim());
}
