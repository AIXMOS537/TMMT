import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { journeyAlertTemplates } from "./journey-alerts";
import { getJourneyHub } from "./queries";

/**
 * Recompute good-standing, checkpoints, LTO flag, and sync journey alerts for one email.
 * Requires service role (cron / webhooks).
 */
export async function recomputeJourneyForEmail(email: string) {
  const supabase = createSupabaseServiceClient();
  const normalized = email.trim().toLowerCase();

  const { data: journeyId, error } = await supabase.rpc("recompute_journey", {
    p_email: normalized,
  });

  if (error) throw error;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  const hub = await getJourneyHub(normalized, profile?.id, supabase);
  const templates = journeyAlertTemplates(hub);

  const alertTypes = templates.map((t) => t.alert_type);
  if (alertTypes.length > 0) {
    await supabase
      .from("client_alerts")
      .delete()
      .eq("customer_email", normalized)
      .in("alert_type", alertTypes)
      .is("acknowledged_at", null);
  }

  for (const t of templates) {
    await supabase.from("client_alerts").insert({
      customer_email: normalized,
      profile_id: profile?.id ?? null,
      alert_type: t.alert_type,
      title: t.title,
      message: t.message,
      priority: t.priority,
      due_at: t.dueInDays
        ? new Date(Date.now() + t.dueInDays * 86400000).toISOString()
        : null,
      metadata: { href: t.href ?? null, source: "journey_recompute" },
    });
  }

  if (hub.education.allAcknowledged && hub.journey) {
    await supabase.from("journey_checkpoint_events").upsert(
      {
        journey_id: hub.journey.id,
        checkpoint_slug: "credit_education_acknowledged",
        evidence: {},
      },
      { onConflict: "journey_id,checkpoint_slug" }
    );
  }

  if (hub.training.coreComplete && hub.journey) {
    await supabase.from("journey_checkpoint_events").upsert(
      {
        journey_id: hub.journey.id,
        checkpoint_slug: "training_core_complete",
        evidence: { core_done: hub.training.coreDone },
      },
      { onConflict: "journey_id,checkpoint_slug" }
    );
  }

  if (hub.gates.basePathSatisfied && hub.journey) {
    await supabase.from("journey_checkpoint_events").upsert(
      {
        journey_id: hub.journey.id,
        checkpoint_slug: "credit_enrollment_active",
        evidence: {},
      },
      { onConflict: "journey_id,checkpoint_slug" }
    );
  }

  if (hub.lto.eligible && hub.journey) {
    await supabase.from("journey_checkpoint_events").upsert(
      {
        journey_id: hub.journey.id,
        checkpoint_slug: "lto_eligible",
        evidence: {},
      },
      { onConflict: "journey_id,checkpoint_slug" }
    );
  }

  return { journeyId, alertCount: templates.length, hub };
}

export async function recomputeAllActiveJourneys() {
  const supabase = createSupabaseServiceClient();
  const { data: journeys } = await supabase
    .from("client_journey")
    .select("customer_email")
    .order("updated_at", { ascending: false })
    .limit(500);

  const emails = [...new Set((journeys ?? []).map((j) => j.customer_email))];
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const email of emails) {
    try {
      await recomputeJourneyForEmail(email);
      results.push({ email, ok: true });
    } catch (e) {
      results.push({ email, ok: false, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  return { processed: results.length, results };
}
