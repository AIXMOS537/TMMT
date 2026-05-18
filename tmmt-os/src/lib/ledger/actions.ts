"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { LEDGER_ENTRY_TYPES, type LedgerEntryType, type LedgerSource } from "./types";

const REVALIDATE_PATHS = [
  "/client/billing",
  "/client/rental",
  "/internal/ledger",
  "/investor/ledger",
  "/vendor/ledger",
  "/admin/dashboard",
];

function revalidateLedgerSurfaces() {
  for (const p of REVALIDATE_PATHS) {
    revalidatePath(p);
  }
}

export async function createLedgerEntry(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in");

  const role = me.role as string;
  let source: LedgerSource = "team";
  if (role === "investor") source = "investor";
  else if (role === "vendor") source = "vendor";
  else if (!["admin", "internal_team"].includes(role)) {
    throw new Error("You do not have permission to post ledger entries.");
  }

  const customerEmail = String(formData.get("customer_email") ?? "").trim().toLowerCase();
  const customerName = String(formData.get("customer_name") ?? "").trim() || null;
  const entryType = String(formData.get("entry_type") ?? "") as LedgerEntryType;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const amountDollars = parseFloat(String(formData.get("amount") ?? "0"));
  const status = String(formData.get("status") ?? "pending");
  const visibleToClient = formData.getAll("visible_to_client").includes("on");
  const caseId = String(formData.get("case_id") ?? "").trim() || null;
  const bookingId = String(formData.get("booking_id") ?? "").trim() || null;

  if (!customerEmail || !title) throw new Error("Customer email and title are required.");
  if (!LEDGER_ENTRY_TYPES.includes(entryType)) throw new Error("Invalid entry type.");
  if (Number.isNaN(amountDollars) || amountDollars < 0) throw new Error("Invalid amount.");

  const amountCents = Math.round(amountDollars * 100);

  const supabase = createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("rental_ledger")
    .insert({
      customer_email: customerEmail,
      customer_name: customerName,
      entry_type: entryType,
      status,
      title,
      description,
      amount_cents: amountCents,
      visible_to_client: visibleToClient,
      source,
      created_by: me.id,
      case_id: caseId,
      booking_id: bookingId,
      organization_id: me.organization_id ?? null,
      metadata: { posted_via: "tmmt_os_ledger_form" },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: customerProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", customerEmail)
    .maybeSingle();

  if (customerProfile?.id && visibleToClient) {
    await supabase.from("notifications").insert({
      recipient: customerProfile.id,
      kind: "ledger_entry",
      title: `Billing update: ${title}`,
      body: description ?? `A new ${entryType.replace(/_/g, " ")} was posted to your account.`,
    });
  }

  await supabase.from("activity_logs").insert({
    actor_id: me.id,
    entity: "rental_ledger",
    entity_id: row.id,
    action: "ledger_entry_created",
    data: { customer_email: customerEmail, entry_type: entryType, amount_cents: amountCents, source },
  });

  revalidateLedgerSurfaces();
  if (caseId) revalidatePath(`/internal/cases/${caseId}`);
}

export async function updateLedgerStatus(entryId: string, status: string) {
  const me = await getCurrentUser();
  if (!me || !["admin", "internal_team", "investor"].includes(me.role as string)) {
    throw new Error("Permission denied");
  }

  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "completed") patch.completed_at = new Date().toISOString();

  const { error } = await supabase.from("rental_ledger").update(patch).eq("id", entryId);
  if (error) throw new Error(error.message);

  revalidateLedgerSurfaces();
}
