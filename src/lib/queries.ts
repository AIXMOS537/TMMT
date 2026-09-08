import { supabase } from "@/lib/supabase";
import { cacheRead, cacheReplace, isBrowserOffline } from "@/lib/offline/store";

/* ──────────── Re-usable fetcher ──────────── */

/**
 * A failed read is not an empty table, and these helpers used to say it was.
 *
 * They caught their own errors and returned [] or 0, which resolves the promise
 * successfully — so the .catch(() => setError("Failed to load data.")) that
 * nearly every consuming page already writes could never fire. A denied policy,
 * a bad key, a dropped connection: all of them rendered as a clean, empty,
 * apparently-correct table, and count() fed 0 into the dashboard's stat cards.
 * There was no way for an operator to tell "no vehicles" from "that query was
 * refused".
 *
 * So they throw now, and the error handling the pages already have starts
 * working. 36 of the 38 files reading through this module have a .catch; the
 * two that do not are server components, where the route's error boundary
 * shows instead. Either way the failure is visible, which is the point.
 */
class QueryError extends Error {
  constructor(table: string, message: string) {
    super(`Could not read ${table}: ${message}`);
    this.name = "QueryError";
  }
}

async function fetchTable<T>(table: string, select = "*", order?: string, limit = 1000): Promise<T[]> {
  if (isBrowserOffline()) {
    return (await cacheRead(table)) as T[];
  }
  let q = supabase.from(table).select(select).limit(limit);
  if (order) q = q.order(order, { ascending: false });
  const { data, error } = await q;
  if (error) {
    console.error(`[${table}]`, error.message);
    // Offline-first (origin/master): serve the cached copy when there is one.
    // But an error with nothing cached is a failure, not an empty table — the
    // page's own .catch can only fire if we actually reject.
    const cached = (await cacheRead(table)) as T[];
    if (cached.length > 0) return cached;
    throw new QueryError(table, error.message);
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
  if (error) {
    console.error(`[${table}] count`, error.message);
    if ((await cacheRead(table)).length > 0) return countFromCache(table);
    throw new QueryError(table, error.message);
  }
  return c ?? 0;
}

async function countWhere(table: string, col: string, val: string): Promise<number> {
  if (isBrowserOffline()) return countFromCache(table, col, val);
  const { count: c, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(col, val);
  if (error) {
    console.error(`[${table}] count ${col}=${val}`, error.message);
    if ((await cacheRead(table)).length > 0) return countFromCache(table, col, val);
    throw new QueryError(table, error.message);
  }
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
    throw new QueryError("lead_pool_feed", error.message);
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
    contractCount,
    handoverCount,
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
    count("contracts"),
    count("vehicle_handover"),
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
    /**
     * The paper trail behind the cars that are out.
     *
     * On 2026-09-01 this read 21 rented, 2 contracts, 1 handover. The forms
     * exist and work; almost nothing reaches them, and nothing in the app said
     * so — a vehicle can be marked Rented with no agreement and no handover
     * record, and every screen looked fine. Surfaced so the gap is visible
     * daily rather than discovered during a dispute or an audit.
     */
    paperTrail: { rented: rentedFleet, contracts: contractCount, handovers: handoverCount },
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

/**
 * Optional inputs for bg_check_decide beyond the verdict itself. Since S3-03
 * (migration 20260907035109) the RPC takes seven arguments; every one after
 * p_notes defaults to null in the database, so a caller that has nothing to say
 * about reasons or programs is still correct.
 *
 * reasonCode is plumbing only. The vocabulary lives in public.reason_codes,
 * which is empty until the owner seeds it (S3-05, owner decision D-19). While
 * it is empty the database accepts a null reason for every decision; once any
 * active code exists, "Not Eligible" requires one and the RPC raises — surface
 * that error, do not invent a code here.
 */
export type BgCheckDecideOptions = {
  /** An ACTIVE code from public.reason_codes. Never make one up in the app. */
  reasonCode?: string | null;
  /** Human explanation stored on the decision event. Defaults to notes in the DB. */
  explanation?: string | null;
  /** programs.slug the customer is being evaluated for, when the caller knows it. */
  productProgram?: string | null;
  /** Idempotency key; see bgCheckDedupeKey for the default. */
  dedupeKey?: string | null;
};

/** What bg_check_decide returns (jsonb). */
export type BgCheckDecideResult = {
  id: string;
  from: string | null;
  to: BgCheckDecision;
  reviewed_at: string;
  decision_event_id: string | null;
  reason_code: string | null;
};

/**
 * Default idempotency key for a decision: `bgcheck:<id>:<decision>:<yyyymmddhhmm>`
 * (UTC), the format the control-plane operating script fixes for app callers.
 *
 * Semantics, from record_decision_event: decision_events.dedupe_key is UNIQUE;
 * a repeat call with a key that already exists returns the existing event id
 * and writes no second event, while bg_check_decide still refreshes the verdict
 * columns on background_checks. So a double-click, a retried request, or a
 * reloaded form re-submitting the same verdict within the same minute is one
 * event. A different verdict, or the same verdict a minute later, is a genuine
 * new decision and gets its own row — the trail is append-only by design.
 */
export function bgCheckDedupeKey(id: string, decision: BgCheckDecision, at: Date = new Date()): string {
  const stamp = at.toISOString().slice(0, 16).replace(/[-T:]/g, ""); // yyyymmddhhmm, UTC
  return `bgcheck:${id}:${decision}:${stamp}`;
}

export async function decideBgCheck(
  id: string,
  decision: BgCheckDecision,
  notes?: string,
  options: BgCheckDecideOptions = {}
): Promise<BgCheckDecideResult> {
  if (!(BG_CHECK_DECISIONS as readonly string[]).includes(decision)) {
    throw new Error(`bg_check_decide: decision must be one of ${BG_CHECK_DECISIONS.join(" | ")}`);
  }
  const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
  const { data, error } = await supabase.rpc("bg_check_decide", {
    p_id: id,
    p_decision: decision,
    p_notes: clean(notes),
    p_reason_code: clean(options.reasonCode),
    p_explanation: clean(options.explanation),
    p_product_program: clean(options.productProgram),
    p_dedupe_key: clean(options.dedupeKey) ?? bgCheckDedupeKey(id, decision),
  });
  if (error) {
    console.error("[bg_check_decide]", error.message);
    throw new Error(error.message);
  }
  return data as BgCheckDecideResult;
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
  // These tables name their status column after the entity — appointment_status,
  // contract_status, vehicle_status, payment_status — not a bare `status`.
  // Reading `.status` does not error: supabase-js hands back the row, the key is
  // simply undefined, so every count lands on 0 and every bucket lands on
  // "Unknown". Silent, and it looks exactly like an empty table.
  const completed = all.filter((a) => a.appointment_status === "Completed").length;
  const noShow = all.filter((a) => a.appointment_status === "No-Show").length;
  const total = all.length || 1;

  const statusCounts: Record<string, number> = {};
  all.forEach((a) => {
    const s = String(a.appointment_status ?? "Unknown");
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

  // contracts.contract_status — see the note on getAppointmentStats.
  const active = all.filter((c) => c.contract_status === "Active").length;
  const draft = all.filter((c) => c.contract_status === "Draft").length;

  const expiringThisWeek = all.filter((c) => {
    if (c.contract_status !== "Active") return false;
    const end = new Date(String(c.end_date ?? ""));
    return end >= now && end <= weekEnd;
  }).length;

  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const terminatedThisMonth = all.filter((c) => {
    if (c.contract_status !== "Terminated") return false;
    const d = new Date(String(c.updated_at ?? c.created_at ?? ""));
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const statusCounts: Record<string, number> = {};
  all.forEach((c) => {
    const s = String(c.contract_status ?? "Unknown");
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
        return sd.startsWith(monthStr) && (c.contract_status === "Signed" || c.contract_status === "Active" || c.contract_status === "Completed");
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

  // fleet.vehicle_status, not .status — see the note on getAppointmentStats.
  const statusCounts: Record<string, number> = {};
  fleet.forEach((v) => {
    const s = String(v.vehicle_status ?? "Unknown");
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
    throw new QueryError("vendor_jobs", error.message);
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
  if (error) throw new QueryError("case_status_history", error.message);
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
    throw new QueryError("vendor_jobs", error.message);
  }
  return data ?? [];
}

export async function getVendorJobUpdates(vendorJobId: string) {
  const { data, error } = await supabase
    .from("vendor_job_updates")
    .select("*")
    .eq("vendor_job_id", vendorJobId)
    .order("created_at", { ascending: false });
  if (error) throw new QueryError("vendor_job_updates", error.message);
  return data ?? [];
}

export async function getVendorJobFiles(vendorJobId: string) {
  const { data, error } = await supabase
    .from("vendor_files")
    .select("*")
    .eq("vendor_job_id", vendorJobId)
    .order("created_at", { ascending: false });
  if (error) throw new QueryError("vendor_files", error.message);
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
    throw new QueryError("ops_threads", error.message);
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
    throw new QueryError("ops_messages", error.message);
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
    throw new QueryError("investor_updates", error.message);
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
    throw new QueryError("time_clock_entries", error.message);
  }
  return data ?? [];
}
