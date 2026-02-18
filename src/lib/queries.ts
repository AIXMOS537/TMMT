import { supabase } from "@/lib/supabase";

/* ──────────── Re-usable fetcher ──────────── */
async function fetchTable<T>(table: string, select = "*", order?: string): Promise<T[]> {
  let q = supabase.from(table).select(select);
  if (order) q = q.order(order, { ascending: false });
  const { data, error } = await q;
  if (error) {
    console.error(`[${table}]`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

async function count(table: string): Promise<number> {
  const { count: c, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return c ?? 0;
}

async function countWhere(table: string, col: string, val: string): Promise<number> {
  const { count: c, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(col, val);
  if (error) return 0;
  return c ?? 0;
}

/* ──────────── Dashboard data ──────────── */
export async function getDashboardData() {
  const [
    totalFleet,
    availableFleet,
    rentedFleet,
    maintenanceFleet,
    totalLeads,
    newLeads,
    qualifiedLeads,
    totalBgChecks,
    pendingBgChecks,
    waitlistCount,
    activeCustomers,
    activeCustomerCount,
    totalTickets,
    openTickets,
    totalPayments,
    overduePayments,
    recentLeads,
    recentTickets,
  ] = await Promise.all([
    count("fleet"),
    countWhere("fleet", "vehicle_status", "Available"),
    countWhere("fleet", "vehicle_status", "Rented"),
    countWhere("fleet", "vehicle_status", "Under Maintenance"),
    count("incoming_leads"),
    countWhere("incoming_leads", "status", "New Lead"),
    countWhere("incoming_leads", "status", "Qualified"),
    count("background_checks"),
    countWhere("background_checks", "background_check_status", "Pending"),
    count("waitlist"),
    count("active_customers"),
    countWhere("active_customers", "status", "Active"),
    count("tickets"),
    countWhere("tickets", "status", "Open"),
    count("customer_payments"),
    countWhere("customer_payments", "payment_status", "Overdue"),
    fetchTable("incoming_leads", "*", "created_on").then(r => r.slice(0, 5)),
    fetchTable("tickets", "*", "date_created").then(r => r.slice(0, 5)),
  ]);

  return {
    fleet: { total: totalFleet, available: availableFleet, rented: rentedFleet, maintenance: maintenanceFleet },
    leads: { total: totalLeads, new: newLeads, qualified: qualifiedLeads },
    bgChecks: { total: totalBgChecks, pending: pendingBgChecks },
    waitlist: waitlistCount,
    customers: { total: activeCustomers, active: activeCustomerCount },
    tickets: { total: totalTickets, open: openTickets },
    payments: { total: totalPayments, overdue: overduePayments },
    recentLeads: recentLeads as Record<string, unknown>[],
    recentTickets: recentTickets as Record<string, unknown>[],
  };
}

/* ──────────── Table fetchers ──────────── */
export const getFleet = () => fetchTable("fleet", "*", "created_at");
export const getLeads = () => fetchTable("incoming_leads", "*", "created_on");
export const getBackgroundChecks = () => fetchTable("background_checks", "*", "created_at");
export const getWaitlist = () => fetchTable("waitlist", "*", "date_added");
export const getAppointments = () => fetchTable("appointments", "*", "appointment_date_time");
export const getActiveCustomers = () => fetchTable("active_customers", "*", "created_at");
export const getPayments = () => fetchTable("customer_payments", "*", "last_payment_date");
export const getInsurance = () => fetchTable("insurance", "*", "created_at");
export const getTickets = () => fetchTable("tickets", "*", "date_created");
export const getExpenses = () => fetchTable("expenses", "*", "expense_date");
export const getInspections = () => fetchTable("fleet_car_inspections", "*", "date_of_inspection");
export const getContracts = () => fetchTable("contracts", "*", "created_at");
export const getVendors = () => fetchTable("shops_mechanics_cleaning", "*", "created_at");
export const getOperationCosts = () => fetchTable("operation_costs", "*", "created_at");
export const getDoNotRent = () => fetchTable("do_not_rent_list", "*", "date_added");
export const getFormerCustomers = () => fetchTable("former_customers", "*", "created_at");
export const getMaintenance = () => fetchTable("maintenance_appointments", "*", "appointment_date_time");
export const getHandovers = () => fetchTable("vehicle_handover", "*", "handover_date");

/* ──────────── Single record ──────────── */
export async function getRecord(table: string, id: string) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

/* ──────────── Upsert ──────────── */
export async function upsertRecord(table: string, record: Record<string, unknown>) {
  const { data, error } = await supabase.from(table).upsert(record).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/* ──────────── Delete ──────────── */
export async function deleteRecord(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
