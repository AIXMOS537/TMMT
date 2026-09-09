import "server-only";
import { reportDegraded } from "@/lib/degraded";
import { resolveVentureDb } from "./client";

/**
 * Counts behind a venture's overview screen.
 *
 * A caveat that belongs in the code and not only in a plan: **no operational
 * table carries a venture column yet.** `ventures` exists (its comment calls it
 * a command center for portfolio businesses) but there is no `venture_id` in
 * any migration, so today venture #1 implicitly owns every row. These counts
 * are therefore whole-table counts, and they are honest only while one venture
 * is live. `scopeToVenture` is the single place that changes when the columns
 * land — until then it is a documented no-op rather than a filter that silently
 * does nothing.
 */
export interface VentureTableCount {
  table: string;
  label: string;
  count: number | null; // null = the count failed, which is not the same as 0
}

const TABLES: Array<{ table: string; label: string }> = [
  { table: "fleet", label: "Vehicles in fleet" },
  { table: "active_customers", label: "Active customers" },
  { table: "contracts", label: "Contracts" },
  { table: "tickets", label: "Tickets" },
  { table: "incoming_leads", label: "Leads" },
  { table: "waitlist", label: "Waitlist" },
  { table: "insurance", label: "Insurance records" },
  { table: "fleet_car_inspections", label: "Inspections" },
  { table: "maintenance_appointments", label: "Maintenance booked" },
  { table: "expenses", label: "Expenses logged" },
  { table: "operation_costs", label: "Operating costs" },
  { table: "do_not_rent_list", label: "Do-not-rent list" },
  { table: "vendors", label: "Vendors" },
];

/**
 * Where per-venture filtering will go. Deliberately a no-op with a reason,
 * so nobody reads a `.eq("venture_id", …)` here and assumes isolation exists.
 */
function scopeToVenture<T>(query: T, _ventureId: string): T {
  return query;
}

export async function getVentureSummary(ventureId: string): Promise<VentureTableCount[]> {
  const db = resolveVentureDb();
  if (!db) {
    reportDegraded("venture-registry", "no Supabase client available for venture summary");
    return TABLES.map(t => ({ ...t, count: null }));
  }

  return Promise.all(
    TABLES.map(async ({ table, label }) => {
      const { count, error } = await scopeToVenture(
        db.from(table).select("*", { count: "exact", head: true }),
        ventureId
      );
      if (error) {
        // One bad table must not blank the whole screen, but it must not read
        // as zero either — the card shows "unavailable" for a null.
        reportDegraded("venture-registry", `count failed for ${table}: ${error.message}`, { table });
        return { table, label, count: null };
      }
      return { table, label, count: count ?? 0 };
    })
  );
}
