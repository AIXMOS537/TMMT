import { createSSRClient } from "@/lib/supabase-server";

/**
 * The fleet as a visitor may see it.
 *
 * Columns are named explicitly and never `*`. anon's SELECT grant covers only the
 * display columns, so a `*` would 42501 the whole query — and, more to the point,
 * vin and plate identify a specific car to anyone who wants to clone the plate or
 * find the vehicle. A listing does not need them.
 */
export type PublicVehicle = {
  id: string;
  label: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  weekly_rate: number | null;
  daily_rate: number | null;
};

export type PublicFleet =
  | { ok: true; vehicles: PublicVehicle[] }
  | { ok: false };

/**
 * Three outcomes, kept distinct on purpose: cars, no cars, and could-not-ask.
 *
 * "We could not reach the fleet" must never render as "no cars available" — that is
 * a lie told to a customer, and it is the exact shape of failure this codebase has
 * been bitten by before. The caller renders `ok: false` as a neutral prompt to get
 * in touch, not as an empty fleet.
 */
export async function getPublicFleet(): Promise<PublicFleet> {
  try {
    const supabase = await createSSRClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("id,label,make,model,year,weekly_rate,daily_rate")
      .eq("active", true)
      .order("weekly_rate", { ascending: true });
    if (error) {
      console.error("[public-fleet] read failed:", error.message);
      return { ok: false };
    }
    return { ok: true, vehicles: (data ?? []) as PublicVehicle[] };
  } catch (err) {
    console.error("[public-fleet] read threw:", err);
    return { ok: false };
  }
}

/** "2017 Toyota Camry", falling back through whatever the row actually has. */
export function vehicleName(v: PublicVehicle): string {
  if (v.label) return v.label;
  const parts = [v.year, v.make, v.model].filter(Boolean);
  return parts.length ? parts.join(" ") : "Vehicle";
}

/** Weekly price, or null when the row carries no rate — never a fabricated 0. */
export function weeklyPrice(v: PublicVehicle): string | null {
  const n = v.weekly_rate;
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
