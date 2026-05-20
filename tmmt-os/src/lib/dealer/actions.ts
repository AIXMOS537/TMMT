"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { upsertDealerFleetRecord } from "./command-center";
import { DEAL_STATUSES } from "./types";

type ActionResult = { success: true; id?: string } | { success: false; error: string };

async function requireOrgId(): Promise<string | null> {
  const me = await requireRole(["admin", "internal_team"]);
  return me.organization_id ?? null;
}

export async function savePartyAction(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "internal_team"]);
  const orgId = await requireOrgId();
  if (!orgId) return { success: false, error: "No organization on profile. Link a pilot org first." };

  const id = formData.get("id")?.toString() || undefined;
  const full_name = formData.get("full_name")?.toString()?.trim();
  if (!full_name) return { success: false, error: "Name is required." };

  const supabase = createSupabaseServerClient();
  const row = {
    organization_id: orgId,
    full_name,
    email: formData.get("email")?.toString()?.trim() || null,
    phone: formData.get("phone")?.toString()?.trim() || null,
    notes: formData.get("notes")?.toString()?.trim() || null,
  };

  if (id) {
    const { error } = await supabase.from("parties").update(row).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/internal/dealer/deals");
    return { success: true, id };
  }

  const { data, error } = await supabase.from("parties").insert(row).select("id").single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/internal/dealer/deals");
  return { success: true, id: data.id };
}

export async function saveDealAction(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "internal_team"]);
  const orgId = await requireOrgId();
  if (!orgId) return { success: false, error: "No organization on profile." };

  const status = formData.get("status")?.toString() ?? "working";
  if (!DEAL_STATUSES.includes(status as (typeof DEAL_STATUSES)[number])) {
    return { success: false, error: "Invalid deal status." };
  }

  const parseNum = (key: string) => {
    const v = formData.get(key)?.toString();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const supabase = createSupabaseServerClient();
  const id = formData.get("id")?.toString() || undefined;
  const row = {
    organization_id: orgId,
    party_id: formData.get("party_id")?.toString() || null,
    fleet_vehicle_id: formData.get("fleet_vehicle_id")?.toString() || null,
    vehicle_label: formData.get("vehicle_label")?.toString()?.trim() || null,
    vin: formData.get("vin")?.toString()?.trim() || null,
    status,
    sale_price: parseNum("sale_price"),
    trade_in_value: parseNum("trade_in_value") ?? 0,
    down_payment: parseNum("down_payment") ?? 0,
    notes: formData.get("notes")?.toString()?.trim() || null,
  };

  if (id) {
    const { error } = await supabase.from("deals").update(row).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/internal/dealer/deals");
    revalidatePath(`/internal/dealer/deals/${id}`);
    return { success: true, id };
  }

  const { data, error } = await supabase.from("deals").insert(row).select("id").single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/internal/dealer/deals");
  return { success: true, id: data.id };
}

export async function upsertFleetAction(
  record: Record<string, unknown>
): Promise<{ success: true } | { success: false; error: string }> {
  await requireRole(["admin", "internal_team"]);
  const res = await upsertDealerFleetRecord(record);
  if (!res.ok) return { success: false, error: res.error };
  revalidatePath("/internal/dealer/inventory");
  return { success: true };
}

export async function logDealPaymentAction(formData: FormData): Promise<ActionResult> {
  await requireRole(["admin", "internal_team"]);

  const deal_id = formData.get("deal_id")?.toString();
  const amountRaw = formData.get("amount")?.toString();
  if (!deal_id || !amountRaw) return { success: false, error: "Deal and amount required." };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Enter a valid amount." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("deal_payments").insert({
    deal_id,
    amount,
    method: formData.get("method")?.toString() || "cash",
    reference: formData.get("reference")?.toString()?.trim() || null,
    notes: formData.get("notes")?.toString()?.trim() || null,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/internal/dealer/payments");
  revalidatePath("/internal/dealer/deals");
  revalidatePath(`/internal/dealer/deals/${deal_id}`);
  return { success: true };
}
