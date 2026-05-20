import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchDealerFleet, isDealerDataBridgeReady } from "./command-center";
import { createCommandCenterClient } from "@/lib/command-center-bridge/client";

export type CollectionsRow = {
  dealId: string;
  refCode: string;
  buyer: string;
  vehicle: string;
  salePrice: number;
  paid: number;
  balance: number;
  nextDue: string | null;
  overdue: boolean;
};

export type ServiceRow = {
  id: string;
  vehicle: string | null;
  serviceType: string | null;
  status: string | null;
  scheduledAt: string | null;
};

export async function fetchCollectionsSummary() {
  const me = await getCurrentUser();
  if (!me?.organization_id) {
    return { rows: [] as CollectionsRow[], totalOutstanding: 0, overdueCount: 0 };
  }

  const supabase = createSupabaseServerClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("id, ref_code, sale_price, next_payment_due, status, vehicle_label, parties(full_name)")
    .eq("organization_id", me.organization_id)
    .in("status", ["sold", "funded", "pending"]);

  const dealIds = (deals ?? []).map((d) => d.id);
  if (!dealIds.length) {
    return { rows: [], totalOutstanding: 0, overdueCount: 0 };
  }

  const { data: payments } = await supabase
    .from("deal_payments")
    .select("deal_id, amount")
    .in("deal_id", dealIds);

  const paidByDeal = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByDeal.set(p.deal_id, (paidByDeal.get(p.deal_id) ?? 0) + Number(p.amount));
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows: CollectionsRow[] = [];

  for (const d of deals ?? []) {
    const salePrice = Number(d.sale_price) || 0;
    const paid = paidByDeal.get(d.id) ?? 0;
    const balance = Math.max(0, salePrice - paid);
    if (balance <= 0 && !d.next_payment_due) continue;

    const nextDue = d.next_payment_due as string | null;
    const overdue = Boolean(nextDue && nextDue < today && balance > 0);

    rows.push({
      dealId: d.id,
      refCode: d.ref_code,
      buyer: (d.parties as { full_name?: string } | null)?.full_name ?? "—",
      vehicle: d.vehicle_label ?? "—",
      salePrice,
      paid,
      balance,
      nextDue,
      overdue,
    });
  }

  rows.sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0));

  return {
    rows,
    totalOutstanding: rows.reduce((s, r) => s + r.balance, 0),
    overdueCount: rows.filter((r) => r.overdue).length,
  };
}

export async function fetchOwnerDashboardMetrics() {
  const me = await getCurrentUser();
  const fleet = isDealerDataBridgeReady() ? await fetchDealerFleet() : [];

  let grossPotential = 0;
  for (const v of fleet) {
    if (v.list_price != null && v.acquisition_cost != null) {
      grossPotential += v.list_price - v.acquisition_cost;
    }
  }

  const collections = await fetchCollectionsSummary();

  return {
    unitsOnLot: fleet.filter((f) => (f.retail_status ?? "available") === "available").length,
    totalInventory: fleet.length,
    grossPotential: Math.round(grossPotential),
    outstandingReceivables: collections.totalOutstanding,
    overdueCount: collections.overdueCount,
  };
}

export async function fetchServiceLaneRows(): Promise<ServiceRow[]> {
  if (!isDealerDataBridgeReady()) return [];
  const db = createCommandCenterClient();
  if (!db) return [];

  const { data, error } = await db
    .from("maintenance_appointments")
    .select("id, vehicle_name, service_type, status, appointment_date_time")
    .order("appointment_date_time", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[service lane]", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    vehicle: (r.vehicle_name as string) ?? null,
    serviceType: (r.service_type as string) ?? null,
    status: (r.status as string) ?? null,
    scheduledAt: (r.appointment_date_time as string) ?? null,
  }));
}
