import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { addContactTag, isGhlConfigured } from "./client";
import type { CaseStatus } from "@/lib/workflow/statuses";

type CaseGhlMeta = {
  ghl?: { contact_id?: string };
};

/** Best-effort GHL side effects — never throws. */
export async function notifyCaseStatusChange(args: {
  caseId: string;
  to: CaseStatus;
  note?: string;
}): Promise<void> {
  if (!isGhlConfigured()) return;

  try {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from("cases")
      .select("metadata")
      .eq("id", args.caseId)
      .maybeSingle();

    const contactId = (data?.metadata as CaseGhlMeta | null)?.ghl?.contact_id;
    if (!contactId) return;

    await addContactTag(contactId, `tmmt-case-${args.to.replace(/_/g, "-")}`);
  } catch (err) {
    console.error("[ghl] notifyCaseStatusChange", args.caseId, err);
  }
}

export async function notifyVendorJobAssigned(args: {
  caseId: string;
  vendorId: string;
  title: string;
}): Promise<void> {
  if (!isGhlConfigured()) return;

  try {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from("cases")
      .select("metadata")
      .eq("id", args.caseId)
      .maybeSingle();

    const contactId = (data?.metadata as CaseGhlMeta | null)?.ghl?.contact_id;
    if (!contactId) return;

    await addContactTag(contactId, "tmmt-vendor-assigned");
  } catch (err) {
    console.error("[ghl] notifyVendorJobAssigned", args.caseId, err);
  }
}
