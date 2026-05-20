import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notifyClientPortalUpdate } from "@/lib/ghl/portal-notify";
import { clientStatusLabel, clientStatusMessage } from "./messages";
import type { CaseStatus } from "@/lib/workflow/statuses";

/** In-app notification when a linked profile exists — best-effort, never throws. */
export async function notifyClientOnCaseStatusChange(args: {
  caseId: string;
  to: CaseStatus;
  note?: string;
}): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data: c } = await supabase
      .from("cases")
      .select("customer_email, ref_code, subject")
      .eq("id", args.caseId)
      .maybeSingle();

    if (!c?.customer_email) return;

    const label = clientStatusLabel(args.to);
    const hint = clientStatusMessage(args.to);
    const body = args.note ? `${hint} Note from team: ${args.note}` : hint;

    void notifyClientPortalUpdate({
      caseId: args.caseId,
      refCode: c.ref_code ?? args.caseId.slice(0, 8),
      customerEmail: c.customer_email,
      title: label,
      body,
      kind: "status_change",
      status: args.to,
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", c.customer_email.trim())
      .maybeSingle();

    if (!profile?.id) return;

    await supabase.from("notifications").insert({
      recipient: profile.id,
      case_id: args.caseId,
      kind: "case_status_change",
      title: `${c.ref_code}: ${label}`,
      body,
    });
  } catch (err) {
    console.error("[notifyClientOnCaseStatusChange]", args.caseId, err);
  }
}
