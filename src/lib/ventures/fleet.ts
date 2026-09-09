import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportDegraded } from "@/lib/degraded";

/**
 * The vehicles behind a venture's fleet screen.
 *
 * Read through the caller's RLS-enforced SSR client, not a service-role one.
 * The counts on the overview use service-role because they are aggregates with
 * no rows attached; a list of actual vehicles is exactly the thing that should
 * stay inside row-level security, the same way `(partner)/partner/page.tsx`
 * does it. Passing the client in rather than building one here is what makes
 * that choice visible at the call site — and testable.
 *
 * Columns match `PartnerFleetRow`, which is the app's existing shape for this
 * table; nothing new is invented here.
 */
export interface VentureFleetRow {
  id: string;
  vehicle_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  year: number | null;
  vehicle_status: string | null;
  license_plate: string | null;
  color: string | null;
}

const COLUMNS = "id,vehicle_name,vehicle_make,vehicle_model,year,vehicle_status,license_plate,color";

export interface VentureFleetResult {
  rows: VentureFleetRow[];
  /** True when the read failed. An empty fleet and an unreadable one differ. */
  failed: boolean;
}

export async function listVentureFleet(db: SupabaseClient): Promise<VentureFleetResult> {
  const { data, error } = await db
    .from("fleet")
    .select(COLUMNS)
    .order("vehicle_status", { ascending: true })
    .order("vehicle_name", { ascending: true })
    .limit(500);

  if (error) {
    reportDegraded("venture-registry", `fleet read failed: ${error.message}`, { table: "fleet" });
    return { rows: [], failed: true };
  }
  return { rows: (data ?? []) as unknown as VentureFleetRow[], failed: false };
}

/** Status counts for the header, derived from the rows already fetched. */
export function summariseFleet(rows: VentureFleetRow[]): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.vehicle_status?.trim() || "Unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}
