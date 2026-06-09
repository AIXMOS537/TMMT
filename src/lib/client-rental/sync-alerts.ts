import type { SupabaseClient } from "@supabase/supabase-js";
import { alertsForCanonicalStage } from "./stage-alerts";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";

export async function syncClientAlertsForStage(
  supabase: SupabaseClient,
  args: {
    customerEmail: string;
    canonicalStage: CanonicalRenterStage;
    ghlContactId?: string | null;
    syncRecordId?: string | null;
    ghlStageLabel?: string;
    profileId?: string | null;
    vehicleLabel?: string;
  }
) {
  const email = args.customerEmail.trim().toLowerCase();
  if (!email) return { inserted: 0 };

  const templates = alertsForCanonicalStage(args.canonicalStage, {
    ghlStageLabel: args.ghlStageLabel,
    vehicleLabel: args.vehicleLabel,
  });

  const alertTypes = templates.map((t) => t.alert_type);

  await supabase
    .from("client_alerts")
    .delete()
    .eq("customer_email", email)
    .is("acknowledged_at", null)
    .in("alert_type", alertTypes);

  const now = Date.now();
  const rows = templates.map((t) => ({
    profile_id: args.profileId ?? null,
    customer_email: email,
    ghl_contact_id: args.ghlContactId ?? null,
    sync_record_id: args.syncRecordId ?? null,
    alert_type: t.alert_type,
    canonical_stage: args.canonicalStage,
    title: t.title,
    message: t.message,
    priority: t.priority,
    due_at: t.dueInDays
      ? new Date(now + t.dueInDays * 24 * 60 * 60 * 1000).toISOString()
      : null,
    metadata: { source: "ghl_pipeline" },
  }));

  const { error } = await supabase.from("client_alerts").insert(rows);
  if (error) throw new Error(error.message);

  return { inserted: rows.length };
}
