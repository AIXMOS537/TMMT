"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { isStaffUser } from "@/lib/auth-roles";
import { logMemoryEventForUser } from "@/lib/memory";

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

  const { error } = await supabase.from(table).upsert(record);
  if (error) {
    console.error(`[${table}] upsert failed:`, error.message);
    return { success: false, error: "Failed to save. Please try again." };
  }

  // Memory Fabric capture (Phase 1) — never blocks the primary write.
  await logMemoryEventForUser(user, {
    action: `upsert:${table}`,
    source: "app",
    summary: `Admin upsert on ${table}`,
    details: { table, record_id: record.id ?? null },
  });

  return { success: true };
}
