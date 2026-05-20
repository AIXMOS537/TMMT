import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { findGhlContactByEmail, isGhlConfigured } from "./client";

type CaseGhlMeta = { ghl?: { contact_id?: string } };

/** Resolve GHL contact id from case metadata, CRM sync, or email lookup. */
export async function resolveGhlContactId(args: {
  caseId?: string;
  customerEmail?: string | null;
  ghlContactId?: string | null;
}): Promise<string | null> {
  if (args.ghlContactId?.trim()) return args.ghlContactId.trim();
  if (!isGhlConfigured()) return null;

  const supabase = createSupabaseServiceClient();

  if (args.caseId) {
    const { data: c } = await supabase.from("cases").select("metadata").eq("id", args.caseId).maybeSingle();
    const fromCase = (c?.metadata as CaseGhlMeta | null)?.ghl?.contact_id;
    if (fromCase) return fromCase;
  }

  const email = args.customerEmail?.trim().toLowerCase();
  if (!email) return null;

  const { data: sync } = await supabase
    .from("crm_sync_records")
    .select("ghl_contact_id")
    .ilike("customer_email", email)
    .not("ghl_contact_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sync?.ghl_contact_id) return sync.ghl_contact_id;

  return findGhlContactByEmail(email);
}
