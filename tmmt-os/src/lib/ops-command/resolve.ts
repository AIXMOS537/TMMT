import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedCase = {
  id: string;
  ref_code: string;
  subject: string;
  customer_name: string;
  customer_email: string | null;
  status: string;
};

export async function resolveCase(
  supabase: SupabaseClient,
  args: { case_id?: string; case_ref?: string; customer_email?: string }
): Promise<ResolvedCase | null> {
  if (args.case_id) {
    const { data } = await supabase
      .from("cases")
      .select("id, ref_code, subject, customer_name, customer_email, status")
      .eq("id", args.case_id)
      .maybeSingle();
    return data;
  }

  if (args.case_ref) {
    const ref = args.case_ref.trim().toUpperCase();
    const { data } = await supabase
      .from("cases")
      .select("id, ref_code, subject, customer_name, customer_email, status")
      .ilike("ref_code", ref)
      .maybeSingle();
    if (data) return data;
  }

  if (args.customer_email) {
    const email = args.customer_email.trim().toLowerCase();
    const { data } = await supabase
      .from("cases")
      .select("id, ref_code, subject, customer_name, customer_email, status")
      .ilike("customer_email", email)
      .not("status", "in", "(completed,closed)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  return null;
}

export async function resolveVendorByName(supabase: SupabaseClient, name: string) {
  const q = name.trim();
  const { data } = await supabase
    .from("vendors")
    .select("id, company_name")
    .eq("active", true)
    .ilike("company_name", `%${q}%`)
    .order("company_name")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function resolveProfileByEmail(supabase: SupabaseClient, email: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", email.trim().toLowerCase())
    .maybeSingle();
  return data;
}
