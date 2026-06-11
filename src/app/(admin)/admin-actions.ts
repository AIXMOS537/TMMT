"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isStaffUser } from "@/lib/auth-roles";

type SaveResult = { success: true } | { success: false; error: string };

const ADMIN_TABLES = new Set([
  "incoming_leads",
  "fleet",
  "partner_fleet_access",
  "active_customers",
  "customer_payments",
  "maintenance_appointments",
  "appointments",
  "background_checks",
  "contracts",
  "do_not_rent_list",
  "expenses",
  "former_customers",
  "fleet_car_inspections",
  "insurance",
  "operation_costs",
  "tickets",
  "shops_mechanics_cleaning",
  "waitlist",
  "vendors",
  "cases",
  "vendor_jobs",
]);

// Universally-rejected keys: prototype pollution + auto-managed columns.
// Per-table column allowlists are tracked as a follow-up; this is the
// table-agnostic floor that closes the worst attacks (proto pollution,
// timestamp tampering, soft-delete-flag flipping) without enumerating
// every column on every table.
const FORBIDDEN_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "created_at",
  "updated_at",
  "deleted_at",
  "is_deleted",
]);

const MAX_KEYS = 100;
const MAX_PAYLOAD_BYTES = 1_000_000;

function sanitizeRecord(
  record: Record<string, unknown>,
): { ok: true; clean: Record<string, unknown>; stripped: string[] } | { ok: false; reason: string } {
  const keys = Object.keys(record);
  if (keys.length > MAX_KEYS) return { ok: false, reason: `too many fields (${keys.length} > ${MAX_KEYS})` };

  const stripped: string[] = [];
  const clean: Record<string, unknown> = {};
  for (const k of keys) {
    if (FORBIDDEN_KEYS.has(k) || k.startsWith("__")) {
      stripped.push(k);
      continue;
    }
    clean[k] = record[k];
  }

  try {
    if (JSON.stringify(clean).length > MAX_PAYLOAD_BYTES) {
      return { ok: false, reason: "payload too large" };
    }
  } catch {
    return { ok: false, reason: "payload not serializable" };
  }

  return { ok: true, clean, stripped };
}

export async function adminUpsert(
  table: string,
  record: Record<string, unknown>
): Promise<SaveResult> {
  if (!ADMIN_TABLES.has(table)) {
    return { success: false, error: "Invalid table." };
  }

  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // redirect() throws NEXT_REDIRECT — the caller never receives a return value
  if (!user) redirect("/login");

  if (!isStaffUser(user)) {
    return { success: false, error: "Not authorized." };
  }

  const sanitized = sanitizeRecord(record);
  if (!sanitized.ok) {
    console.warn(`[${table}] upsert rejected: ${sanitized.reason}`);
    return { success: false, error: "Invalid record." };
  }
  if (sanitized.stripped.length > 0) {
    console.warn(`[${table}] upsert stripped forbidden keys: ${sanitized.stripped.join(", ")}`);
  }

  const { error } = await supabase.from(table).upsert(sanitized.clean);
  if (error) {
    console.error(`[${table}] upsert failed:`, error.message);
    return { success: false, error: "Failed to save. Please try again." };
  }
  return { success: true };
}
