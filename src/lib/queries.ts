import { supabase } from "@/lib/supabase";

/* ──────────── Re-usable fetcher ──────────── */
async function fetchTable<T>(table: string, select = "*", order?: string, limit = 1000): Promise<T[]> {
  let q = supabase.from(table).select(select).limit(limit);
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

/* ── Interface Aggregation Queries ──────────────────────────── */

export async function getAppointmentStats() {
  const all = await getAppointments() as Record<string, unknown>[];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const today = all.filter(
    (a) => String(a.appointment_date_time ?? "").slice(0, 10) === todayStr
  );
  const thisWeek = all.filter((a) => {
    const d = new Date(String(a.appointment_date_time ?? ""));
    return d >= weekStart && d <= now;
  });
  const completed = all.filter((a) => a.status === "Completed").length;
  const noShow = all.filter((a) => a.status === "No-Show").length;
  const total = all.length || 1;

  const statusCounts: Record<string, number> = {};
  all.forEach((a) => {
    const s = String(a.status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const dayCounts: { name: string; value: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    dayCounts.push({
      name: dayNames[i],
      value: all.filter(
        (a) => String(a.appointment_date_time ?? "").slice(0, 10) === ds
      ).length,
    });
  }

  return {
    today: today.length,
    thisWeek: thisWeek.length,
    completionRate: Math.round((completed / total) * 100),
    noShowRate: Math.round((noShow / total) * 100),
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
    perDay: dayCounts,
    all,
  };
}

export async function getContractStats() {
  const all = await getContracts() as Record<string, unknown>[];
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const active = all.filter((c) => c.status === "Active").length;
  const draft = all.filter((c) => c.status === "Draft").length;

  const expiringThisWeek = all.filter((c) => {
    if (c.status !== "Active") return false;
    const end = new Date(String(c.end_date ?? ""));
    return end >= now && end <= weekEnd;
  }).length;

  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const terminatedThisMonth = all.filter((c) => {
    if (c.status !== "Terminated") return false;
    const d = new Date(String(c.updated_at ?? c.created_at ?? ""));
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const statusCounts: Record<string, number> = {};
  all.forEach((c) => {
    const s = String(c.status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const signedOverTime: { name: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    signedOverTime.push({
      name: label,
      value: all.filter((c) => {
        const sd = String(c.signed_date ?? c.created_at ?? "");
        return sd.startsWith(monthStr) && (c.status === "Signed" || c.status === "Active" || c.status === "Completed");
      }).length,
    });
  }

  return {
    active,
    expiringThisWeek,
    draft,
    terminatedThisMonth,
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
    signedOverTime,
    all,
  };
}

export async function getVehicleStats() {
  const fleet = await getFleet() as Record<string, unknown>[];
  const payments = await getPayments() as Record<string, unknown>[];

  const statusCounts: Record<string, number> = {};
  fleet.forEach((v) => {
    const s = String(v.status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const revenueMap: Record<string, number> = {};
  payments.forEach((p) => {
    const vName = String(p.vehicle ?? p.vehicle_name ?? "Unknown");
    const amt = Number(p.amount) || 0;
    revenueMap[vName] = (revenueMap[vName] || 0) + amt;
  });
  const revenuePerVehicle = Object.entries(revenueMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    total: fleet.length,
    available: statusCounts["Available"] ?? 0,
    rented: statusCounts["Rented"] ?? 0,
    underMaintenance: statusCounts["Under Maintenance"] ?? 0,
    needsRepair: statusCounts["Needs Repair"] ?? 0,
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
    revenuePerVehicle,
    all: fleet,
  };
}

export async function getPaymentStats() {
  const all = await getPayments() as Record<string, unknown>[];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const thisMonthPayments = all.filter((p) => {
    const d = new Date(String(p.last_payment_date ?? p.created_at ?? ""));
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const collected = thisMonthPayments
    .filter((p) => p.payment_status === "Paid")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const pending = all
    .filter((p) => p.payment_status === "Pending")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const overdue = all
    .filter((p) => p.payment_status === "Overdue")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const paidCount = all.filter((p) => p.payment_status === "Paid").length;
  const avgPayment = paidCount > 0
    ? all.filter((p) => p.payment_status === "Paid").reduce((s, p) => s + (Number(p.amount) || 0), 0) / paidCount
    : 0;

  const statusCounts: Record<string, number> = {};
  all.forEach((p) => {
    const s = String(p.payment_status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const methodCounts: Record<string, number> = {};
  all.forEach((p) => {
    const m = String(p.payment_method ?? "Unknown");
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  });

  const revenueOverTime: { name: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    revenueOverTime.push({
      name: label,
      value: all
        .filter((p) => {
          const pd = String(p.last_payment_date ?? p.created_at ?? "");
          return pd.startsWith(monthStr) && p.payment_status === "Paid";
        })
        .reduce((s, p) => s + (Number(p.amount) || 0), 0),
    });
  }

  return {
    collectedThisMonth: collected,
    pending,
    overdue,
    avgPayment: Math.round(avgPayment),
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
    byMethod: Object.entries(methodCounts).map(([name, value]) => ({ name, value })),
    revenueOverTime,
    all,
  };
}

/* ──────────── Workflow engine ──────────── */

export async function getCases() {
  return fetchTable<Record<string, unknown>>("cases", "*", "created_at");
}

export async function getWorkflowVendors() {
  return fetchTable<Record<string, unknown>>("vendors", "*", "name");
}

export async function getVendorJobsForStaff(caseId?: string) {
  let q = supabase
    .from("vendor_jobs")
    .select("*, vendors(name), cases(case_number, title)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (caseId) q = q.eq("case_id", caseId);
  const { data, error } = await q;
  if (error) {
    console.error("[vendor_jobs]", error.message);
    return [];
  }
  return data ?? [];
}

export async function getCaseStatusHistory(caseId: string) {
  const { data, error } = await supabase
    .from("case_status_history")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

export async function getVendorPortalJobs() {
  const { data, error } = await supabase
    .from("vendor_jobs")
    .select("*, cases(case_number, title, customer_name, status)")
    .order("offered_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[vendor portal jobs]", error.message);
    return [];
  }
  return data ?? [];
}

export async function getVendorJobUpdates(vendorJobId: string) {
  const { data, error } = await supabase
    .from("vendor_job_updates")
    .select("*")
    .eq("vendor_job_id", vendorJobId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getVendorJobFiles(vendorJobId: string) {
  const { data, error } = await supabase
    .from("vendor_files")
    .select("*")
    .eq("vendor_job_id", vendorJobId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getOpsThreads() {
  const { data, error } = await supabase
    .from("ops_threads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[ops_threads]", error.message);
    return [];
  }
  return data ?? [];
}

export async function getOpsMessages(filters?: {
  audience?: string;
  status?: string;
  threadId?: string;
}) {
  let q = supabase
    .from("ops_messages")
    .select("*, ops_threads(title)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters?.audience) q = q.eq("audience", filters.audience);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.threadId) q = q.eq("thread_id", filters.threadId);

  const { data, error } = await q;
  if (error) {
    console.error("[ops_messages]", error.message);
    return [];
  }
  return data ?? [];
}

export async function getInvestorUpdates() {
  const { data, error } = await supabase
    .from("investor_updates")
    .select("*")
    .eq("visible_to_investors", true)
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[investor_updates]", error.message);
    return [];
  }
  return data ?? [];
}
