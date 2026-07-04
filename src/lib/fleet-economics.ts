/**
 * src/lib/fleet-economics.ts
 *
 * Pure metric engine for the Fleet Economics Command Center (WS1). Takes clean
 * typed inputs (mapped from Supabase/Airtable rows by the caller) and computes
 * utilization, revenue/vehicle, cost, net, and ROI. No I/O, no framework — so it
 * is fully unit-tested and reused by the dashboard page and any report.
 */

export interface FleetVehicleInput {
  id: string;
  name: string;
  /** Raw status label from the fleet row (e.g. "Rented", "Under Maintenance"). */
  status: string;
  /** What the vehicle cost to acquire, if known. Used as the ROI denominator. */
  acquisitionCost?: number | null;
}

export interface RevenueInput {
  /** Vehicle name/identifier this payment is attributed to. */
  vehicle: string;
  amount: number;
  /** Whether this payment counts as collected revenue (e.g. status === "Paid"). */
  counts: boolean;
}

export interface CostInput {
  vehicle?: string | null;
  amount: number;
}

export type FleetStatusBucket =
  | "rented"
  | "available"
  | "maintenance"
  | "needs_repair"
  | "other";

/** `type` (not `interface`) so it satisfies the `Record<string, unknown>`
 *  constraint on the shared <DataTable/> component. */
export type VehicleEconomics = {
  name: string;
  status: string;
  bucket: FleetStatusBucket;
  revenue: number;
  cost: number;
  net: number;
  /** net / acquisitionCost * 100, or null when the acquisition cost is unknown. */
  roiPct: number | null;
};

export interface FleetEconomics {
  fleetSize: number;
  rented: number;
  available: number;
  maintenance: number;
  needsRepair: number;
  /** rented / fleetSize. */
  utilizationPct: number;
  /** rented / (rented + available) — utilization of the vehicles that *can* rent. */
  operationalUtilizationPct: number;
  totalRevenue: number;
  avgRevenuePerVehicle: number;
  totalCost: number;
  netProfit: number;
  /** netProfit / total known acquisition cost * 100, or null when none is known. */
  fleetRoiPct: number | null;
  perVehicle: VehicleEconomics[];
}

/** Round to cents to avoid floating-point noise in the UI. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Safe percentage — 0 when the denominator is 0 (never NaN/Infinity). */
export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return round2((part / whole) * 100);
}

/** Map a free-text fleet status onto a canonical bucket. */
export function classifyStatus(raw: string): FleetStatusBucket {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("repair")) return "needs_repair";
  if (s.includes("mainten")) return "maintenance";
  if (s.includes("rent")) return "rented"; // "Rented"
  if (s.includes("avail")) return "available";
  return "other";
}

function normalizeKey(name: string): string {
  return (name ?? "").trim().toLowerCase();
}

export function computeFleetEconomics(
  vehicles: FleetVehicleInput[],
  revenue: RevenueInput[],
  costs: CostInput[] = []
): FleetEconomics {
  // Aggregate revenue + cost by vehicle key.
  const revByVehicle = new Map<string, number>();
  for (const r of revenue) {
    if (!r.counts) continue;
    const k = normalizeKey(r.vehicle);
    revByVehicle.set(k, (revByVehicle.get(k) ?? 0) + (Number(r.amount) || 0));
  }
  const costByVehicle = new Map<string, number>();
  for (const c of costs) {
    const k = normalizeKey(c.vehicle ?? "");
    costByVehicle.set(k, (costByVehicle.get(k) ?? 0) + (Number(c.amount) || 0));
  }

  let rented = 0;
  let available = 0;
  let maintenance = 0;
  let needsRepair = 0;
  let totalAcqCost = 0;

  const perVehicle: VehicleEconomics[] = vehicles.map((v) => {
    const bucket = classifyStatus(v.status);
    if (bucket === "rented") rented++;
    else if (bucket === "available") available++;
    else if (bucket === "maintenance") maintenance++;
    else if (bucket === "needs_repair") needsRepair++;

    const key = normalizeKey(v.name);
    const rev = round2(revByVehicle.get(key) ?? 0);
    const cost = round2(costByVehicle.get(key) ?? 0);
    const net = round2(rev - cost);
    const acq = Number(v.acquisitionCost) || 0;
    if (acq > 0) totalAcqCost += acq;

    return {
      name: v.name,
      status: v.status,
      bucket,
      revenue: rev,
      cost,
      net,
      roiPct: acq > 0 ? round2((net / acq) * 100) : null,
    };
  });

  perVehicle.sort((a, b) => b.net - a.net);

  const fleetSize = vehicles.length;
  const totalRevenue = round2(perVehicle.reduce((s, v) => s + v.revenue, 0));
  const totalCost = round2(perVehicle.reduce((s, v) => s + v.cost, 0));
  const netProfit = round2(totalRevenue - totalCost);

  return {
    fleetSize,
    rented,
    available,
    maintenance,
    needsRepair,
    utilizationPct: pct(rented, fleetSize),
    operationalUtilizationPct: pct(rented, rented + available),
    totalRevenue,
    avgRevenuePerVehicle: fleetSize ? round2(totalRevenue / fleetSize) : 0,
    totalCost,
    netProfit,
    fleetRoiPct: totalAcqCost > 0 ? round2((netProfit / totalAcqCost) * 100) : null,
    perVehicle,
  };
}
