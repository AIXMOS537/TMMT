import { createServiceRoleClient } from "@/lib/supabase-service";
import { addContactTag, isGhlConfigured } from "./client";
import { canonicalStageForCaseStatus } from "./case-status-to-canonical";
import { pushCanonicalStageToGhl } from "./sync-outbound";
import { syncContactPortalFields } from "./sync-contact-portal-fields";
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
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("cases")
      .select("metadata, ref_code, customer_email")
      .eq("id", args.caseId)
      .maybeSingle();

    const contactId = (data?.metadata as CaseGhlMeta | null)?.ghl?.contact_id;

    if (data?.ref_code) {
      await syncContactPortalFields({
        refCode: data.ref_code,
        caseId: args.caseId,
        customerEmail: data.customer_email,
        ghlContactId: contactId,
      });
    }

    if (contactId) {
      await addContactTag(contactId, `tmmt-case-${args.to.replace(/_/g, "-")}`);
      await addContactTag(contactId, "tmmt-portal-alert");
    }

    const canonical = canonicalStageForCaseStatus(args.to);
    if (canonical) {
      await pushCanonicalStageToGhl({
        caseId: args.caseId,
        canonical,
        source: `case_status:${args.to}`,
      });
    }
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
    const supabase = createServiceRoleClient();
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
