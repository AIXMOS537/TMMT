import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { DealPaymentRow, DealRow } from "./types";

export async function fetchDealsForOrg(): Promise<DealRow[]> {
  const me = await getCurrentUser();
  if (!me?.organization_id) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*, parties(full_name)")
    .eq("organization_id", me.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[deals]", error.message);
    return [];
  }
  return (data ?? []) as DealRow[];
}

export async function fetchDealById(id: string): Promise<DealRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*, parties(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as DealRow;
}

export async function fetchPartiesForOrg() {
  const me = await getCurrentUser();
  if (!me?.organization_id) return [];

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("parties")
    .select("id, full_name, email, phone")
    .eq("organization_id", me.organization_id)
    .order("full_name");

  return data ?? [];
}

export async function fetchDealPayments(): Promise<DealPaymentRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("deal_payments")
    .select("*, deals(ref_code, vehicle_label)")
    .order("paid_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[deal_payments]", error.message);
    return [];
  }
  return (data ?? []) as DealPaymentRow[];
}

export async function fetchDealPaymentsForDeal(dealId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("deal_payments")
    .select("*")
    .eq("deal_id", dealId)
    .order("paid_at", { ascending: false });

  return data ?? [];
}
