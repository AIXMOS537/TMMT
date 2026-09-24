import { createServiceRoleClient } from "@/lib/supabase-service";
import { isGhlConfigured } from "@/lib/ghl/client";
import type { MarketingKpiWeek } from "./types";

export type GhlKpiAutoMetrics = {
  new_subscribers: number;
  calls_booked: number;
  dm_started: number;
  email_list_growth: number;
  source: "ghl_mirror" | "ghl_api";
  details: Record<string, number>;
};

function tagPatterns(): string[] {
  const raw =
    process.env.GHL_KPI_SUBSCRIBER_TAG_PATTERNS?.trim() ||
    "vip,subscriber,credit:monthly,monthly-97,monthly_97,operator:candidate";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function appointmentPatterns(): string[] {
  const raw =
    process.env.GHL_KPI_STRATEGY_APPOINTMENT_PATTERNS?.trim() ||
    "strategy,discovery,consult,call booked";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function matchesAnyTag(tags: string[] | null, patterns: string[]): boolean {
  if (!tags?.length) return false;
  const lower = tags.map((t) => t.toLowerCase());
  return patterns.some((p) => lower.some((t) => t.includes(p)));
}

function matchesAppointmentTitle(title: string | null, patterns: string[]): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return patterns.some((p) => t.includes(p));
}

export function weekBoundsUtc(weekStart: string): { start: string; end: string } {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Pull subscriber/call/form metrics from mirrored GHL tables (+ credit enrollments). */
export async function collectGhlKpiMetrics(weekStart: string): Promise<GhlKpiAutoMetrics> {
  const supabase = createServiceRoleClient();
  const { start, end } = weekBoundsUtc(weekStart);
  const subTags = tagPatterns();
  const apptPatterns = appointmentPatterns();

  const [contactsRes, appointmentsRes, formsRes, creditRes] = await Promise.all([
    supabase
      .from("ghl_contacts")
      .select("id, tags, synced_at, created_at, updated_at")
      .gte("synced_at", start)
      .lt("synced_at", end),
    supabase
      .from("ghl_appointments")
      .select("id, title, starts_at, status")
      .gte("starts_at", start)
      .lt("starts_at", end),
    supabase
      .from("ghl_form_submissions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("credit_billing_plans")
      .select("id", { count: "exact", head: true })
      .eq("credit_path", "monthly_97")
      .gte("created_at", start)
      .lt("created_at", end),
  ]);

  // Every read must succeed: a failed read used to fall through as `?? []` /
  // `?? 0` and publish an all-zero week as if it were real (finding F-11).
  const failed = (
    [
      ["ghl_contacts", contactsRes.error],
      ["ghl_appointments", appointmentsRes.error],
      ["ghl_form_submissions", formsRes.error],
      ["credit_billing_plans", creditRes.error],
    ] as const
  ).filter(([, err]) => err);
  if (failed.length > 0) {
    throw new Error(
      `marketing KPI read failed: ${failed.map(([t, err]) => `${t} (${err?.code ?? "?"}: ${err?.message})`).join("; ")}`
    );
  }

  const contacts = contactsRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];

  const subscriberFromTags = contacts.filter((c) =>
    matchesAnyTag(c.tags as string[], subTags)
  ).length;

  const emailListGrowth = contacts.length;
  const callsBooked = appointments.filter(
    (a) =>
      matchesAppointmentTitle(a.title, apptPatterns) ||
      (a.status?.toLowerCase() === "confirmed" && matchesAppointmentTitle(a.title, ["call", "meeting"]))
  ).length;

  const dmStarted = formsRes.count ?? 0;
  const creditEnrollments = creditRes.count ?? 0;
  const newSubscribers = Math.max(subscriberFromTags, creditEnrollments);

  return {
    new_subscribers: newSubscribers,
    calls_booked: callsBooked,
    dm_started: dmStarted,
    email_list_growth: emailListGrowth,
    source: isGhlConfigured() ? "ghl_mirror" : "ghl_mirror",
    details: {
      contacts_synced: contacts.length,
      subscriber_tag_hits: subscriberFromTags,
      credit_monthly_97_new: creditEnrollments,
      appointments_in_week: appointments.length,
      strategy_appointments: callsBooked,
      form_submissions: dmStarted,
    },
  };
}

/** Merge GHL auto metrics into marketing_kpi_weeks (preserves manual social fields). */
export async function syncMarketingKpiWeekFromGhl(weekStart: string): Promise<{
  row: MarketingKpiWeek | null;
  auto: GhlKpiAutoMetrics;
}> {
  const supabase = createServiceRoleClient();
  const auto = await collectGhlKpiMetrics(weekStart);

  const { data: existing, error: existingError } = await supabase
    .from("marketing_kpi_weeks")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  // Without the existing row the upsert below would zero the manual social fields.
  if (existingError) throw existingError;

  const merged = {
    week_start: weekStart,
    followers: existing?.followers ?? 0,
    reel_views: existing?.reel_views ?? 0,
    story_views: existing?.story_views ?? 0,
    dm_started: auto.dm_started,
    calls_booked: auto.calls_booked,
    new_subscribers: auto.new_subscribers,
    email_list_growth: auto.email_list_growth,
    notes: existing?.notes ?? null,
    ghl_auto: auto,
    ghl_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("marketing_kpi_weeks")
    .upsert(merged, { onConflict: "week_start" })
    .select("*")
    .single();

  if (error) throw error;
  return { row: data as MarketingKpiWeek, auto };
}
