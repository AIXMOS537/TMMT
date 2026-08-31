import { supabase } from "@/lib/supabase";
import { cacheRead, cacheReplace, isBrowserOffline } from "@/lib/offline/store";

/* ──────────── Re-usable fetcher ──────────── */
async function fetchTable<T>(table: string, select = "*", order?: string, limit = 1000): Promise<T[]> {
  if (isBrowserOffline()) {
    return (await cacheRead(table)) as T[];
  }
  let q = supabase.from(table).select(select).limit(limit);
  if (order) q = q.order(order, { ascending: false });
  const { data, error } = await q;
  if (error) {
    console.error(`[${table}]`, error.message);
    return (await cacheRead(table)) as T[];
  }
  const rows = (data ?? []) as T[];
  await cacheReplace(table, rows as Record<string, unknown>[]);
  return rows;
}

async function countFromCache(table: string, col?: string, val?: string): Promise<number> {
  const rows = await cacheRead(table);
  if (!col) return rows.length;
  return rows.filter((r) => String(r[col] ?? "") === val).length;
}

async function count(table: string): Promise<number> {
  if (isBrowserOffline()) return countFromCache(table);
  const { count: c, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return countFromCache(table);
  return c ?? 0;
}

async function countWhere(table: string, col: string, val: string): Promise<number> {
  if (isBrowserOffline()) return countFromCache(table, col, val);
  const { count: c, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(col, val);
  if (error) return countFromCache(table, col, val);
  return c ?? 0;
}

/* ──────────── Lead pool feed (operator UI) ──────────── */
export type LeadPoolRow = {
  pool_id: number;
  lead_id: string;
  vertical: string;
  agency_org_id: string;
  status: string;
  origin: string | null;
  created_at: string;
  claimed_at: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  campaign: string | null;
  [key: string]: unknown;
};

async function leadPoolFeed(scope: "available" | "mine"): Promise<LeadPoolRow[]> {
  const { data, error } = await supabase.rpc("lead_pool_feed", { p_scope: scope });
  if (error) {
    console.error(`[lead_pool_feed ${scope}]`, error.message);
    return [];
  }
  return (data ?? []) as LeadPoolRow[];
}

export const getAvailableLeads = () => leadPoolFeed("available");
export const getMyLeads = () => leadPoolFeed("mine");

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

  // background_checks and customer_payments are admin-only, so those two counts come back
  // as 0 for staff. Rather than show a misleading zero, take the background-check numbers
  // from the review queue staff can legitimately see, and flag payments as restricted.
  const admin = await isPlatformAdmin();
  let bgTotal = totalBgChecks;
  let bgPending = pendingBgChecks;
  if (!admin) {
    try {
      const queue = await getBgCheckQueue(undefined, 500);
      bgTotal = queue.length;
      bgPending = queue.filter(
        (r) => !r.eligibility_status || r.eligibility_status === "Need Manager's Review"
      ).length;
    } catch {
      bgTotal = 0;
      bgPending = 0;
    }
  }

  return {
    fleet: { total: totalFleet, available: availableFleet, rented: rentedFleet, maintenance: maintenanceFleet },
    leads: { total: totalLeads, new: newLeads, qualified: qualifiedLeads },
    bgChecks: { total: bgTotal, pending: bgPending },
    waitlist: waitlistCount,
    customers: { total: activeCustomers, active: activeCustomerCount },
    tickets: { total: totalTickets, open: openTickets },
    payments: { total: totalPayments, overdue: overduePayments, restricted: !admin },
    recentLeads: recentLeads as Record<string, unknown>[],
    recentTickets: recentTickets as Record<string, unknown>[],
  };
}

/* ──────────── Table fetchers ──────────── */
export const getFleet = () => fetchTable("fleet", "*", "created_at");
export const getLeads = () => fetchTable("incoming_leads", "*", "created_on");
export const getBackgroundChecks = () => fetchTable("background_checks", "*", "created_at");

/* ──────────── Background-check review (staff) ────────────
   background_checks is admin-only at the database level. Staff review through
   these two RPCs instead: the queue returns masked contact details and document
   presence flags rather than the raw licence / paystub / insurance payloads. */

export type BgCheckQueueRow = {
  id: string;
  customer_name: string | null;
  email_masked: string | null;
  phone_last4: string | null;
  created_at: string | null;
  verification_form_submitted: boolean | null;
  has_license: boolean | null;
  has_insurance_proof: boolean | null;
  has_paystub: boolean | null;
  has_screenshot: boolean | null;
  key_details: string | null;
  eligibility_status: string | null;
  review_notes: string | null;
  date_verified: string | null;
  reviewed_at: string | null;
};

export const BG_CHECK_DECISIONS = [
  "Eligible",
  "Not Eligible",
  "Need Manager's Review",
  "out of radius",
  "Not found",
] as const;

export type BgCheckDecision = (typeof BG_CHECK_DECISIONS)[number];

export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) {
    console.error("[is_platform_admin]", error.message);
    return false;
  }
  return data === true;
}

export async function getBgCheckQueue(status?: string, limit = 300): Promise<BgCheckQueueRow[]> {
  const { data, error } = await supabase.rpc("bg_check_queue", {
    p_status: status || null,
    p_limit: limit,
  });
  if (error) {
    console.error("[bg_check_queue]", error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as BgCheckQueueRow[];
}

export async function decideBgCheck(
  id: string,
  decision: BgCheckDecision,
  notes?: string
): Promise<void> {
  const { error } = await supabase.rpc("bg_check_decide", {
    p_id: id,
    p_decision: decision,
    p_notes: notes?.trim() ? notes.trim() : null,
  });
  if (error) {
    console.error("[bg_check_decide]", error.message);
    throw new Error(error.message);
  }
}
export const getTasks = () => fetchTable("tasks", "*", "created_at");
export const getWaitlist = () => fetchTable("waitlist", "*", "date_added_to_waitlist");
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
export const getCreditFundingSessions = () => fetchTable("credit_funding_sessions", "*", "created_at");

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
    .select("*, vendors(name), cases(ref_code, subject, case_number, title)")
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
    .select("*, cases(ref_code, subject, case_number, title, customer_name, status)")
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

/* ──────────── Time clock (timesheets) ──────────── */
export async function getTimeClock() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await supabase
    .from("time_clock_entries")
    .select("id, user_id, user_email, clock_in, clock_out")
    .gte("clock_in", since.toISOString())
    .order("clock_in", { ascending: false });
  if (error) {
    console.error("[time_clock]", error.message);
    return [];
  }
  return data ?? [];
}
