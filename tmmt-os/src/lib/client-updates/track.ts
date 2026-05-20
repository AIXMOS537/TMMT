import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { clientStatusLabel, clientStatusMessage } from "./messages";
import type { CaseStatus } from "@/lib/workflow/statuses";

export type PublicCaseStatus = {
  ref_code: string;
  subject: string;
  status: CaseStatus;
  status_label: string;
  status_message: string;
  updated_at: string;
  created_at: string;
};

/** Lookup by ref + email — no login required (service role, minimal fields). */
export async function lookupCaseByRefAndEmail(
  refCode: string,
  email: string
): Promise<PublicCaseStatus | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("cases")
    .select("ref_code, subject, status, updated_at, created_at, customer_email")
    .eq("ref_code", refCode.trim().toUpperCase())
    .maybeSingle();

  if (!data?.customer_email) return null;
  if (data.customer_email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;

  const status = data.status as CaseStatus;
  return {
    ref_code: data.ref_code,
    subject: data.subject,
    status,
    status_label: clientStatusLabel(status),
    status_message: clientStatusMessage(status),
    updated_at: data.updated_at,
    created_at: data.created_at,
  };
}
