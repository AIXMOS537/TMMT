import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Money Meter — ONE unified view of every dollar AIXMOS/TMMT touches.
 *
 * Sort of like OmniRouter's live meter, but for the whole business: money
 * COLLECTED (in), money USED (out/cost), and money SAVED (avoided). It reads
 * the append-only `money_meter_events` ledger (migration 20260718000000).
 *
 * FREE FOREVER FOR THE OWNER + FAMILY. Free-forever orgs still get their usage
 * recorded so the meter shows what it *would* have cost, but those 'used' events
 * carry `billable = false`, so their net billable spend is always $0. The DB
 * stamps that (see money_meter_record); this module just surfaces it.
 *
 * Pattern mirrors src/lib/revenue.ts: pure, unit-testable summary functions +
 * thin typed server wrappers around the service-role RPC.
 */

// ── Directions & categories ─────────────────────────────────────────────────
export type MoneyDirection = "collected" | "used" | "saved";

/** Open-ended, but these are the categories the platform records today. */
export type MoneyCategory =
  | "ai_llm" // cloud model spend (Anthropic/OpenAI via the gateway)
  | "sms" // Twilio / messaging
  | "subscription" // SaaS the platform pays for
  | "ad_spend" // paid acquisition
  | "commission" // operator payouts
  | "sale" // product/membership revenue
  | "deposit" // build/deal deposits
  | "token_purchase" // TMMT token top-ups bought through us
  | "other";

export type MoneyEvent = {
  org_id: string | null;
  direction: MoneyDirection;
  category: string;
  amount_usd: number;
  billable: boolean;
  source?: string | null;
  ref?: string | null;
  occurred_at?: string | null;
};

export type MoneySummary = {
  /** Money IN. */
  collected: number;
  /** Money OUT that someone is actually billed for (excludes free-forever usage). */
  usedBillable: number;
  /** ALL money OUT including free-forever usage (what it *would* cost). */
  usedAll: number;
  /** Money AVOIDED (local inference vs cloud, discounts). */
  saved: number;
  /** collected − usedBillable. The bottom line. */
  net: number;
  /** usedAll − usedBillable: the dollar value given away free (owner + family). */
  freeForeverValue: number;
};

export type CategoryBreakdown = {
  category: string;
  collected: number;
  usedBillable: number;
  usedAll: number;
  saved: number;
};

function amountOf(row: Pick<MoneyEvent, "amount_usd">): number {
  const n = Number(row.amount_usd);
  return Number.isFinite(n) ? n : 0;
}

/** Roll a list of ledger events up into the top-line meter. Pure. */
export function summarizeMoney(events: MoneyEvent[]): MoneySummary {
  const s: MoneySummary = {
    collected: 0,
    usedBillable: 0,
    usedAll: 0,
    saved: 0,
    net: 0,
    freeForeverValue: 0,
  };
  for (const e of events) {
    const amt = amountOf(e);
    if (e.direction === "collected") s.collected += amt;
    else if (e.direction === "saved") s.saved += amt;
    else if (e.direction === "used") {
      s.usedAll += amt;
      if (e.billable) s.usedBillable += amt;
    }
  }
  s.freeForeverValue = s.usedAll - s.usedBillable;
  s.net = s.collected - s.usedBillable;
  return s;
}

/** Same numbers, split per category, highest total-activity first. Pure. */
export function summarizeByCategory(events: MoneyEvent[]): CategoryBreakdown[] {
  const by = new Map<string, CategoryBreakdown>();
  for (const e of events) {
    const key = (e.category || "other").trim() || "other";
    const row = by.get(key) ?? { category: key, collected: 0, usedBillable: 0, usedAll: 0, saved: 0 };
    const amt = amountOf(e);
    if (e.direction === "collected") row.collected += amt;
    else if (e.direction === "saved") row.saved += amt;
    else if (e.direction === "used") {
      row.usedAll += amt;
      if (e.billable) row.usedBillable += amt;
    }
    by.set(key, row);
  }
  return [...by.values()].sort(
    (a, b) => b.collected + b.usedAll + b.saved - (a.collected + a.usedAll + a.saved)
  );
}

// ── Free-forever config (app layer) ─────────────────────────────────────────
// The DB is the source of truth (money_meter_accounts.free_forever), but the
// app also honors an env allowlist of emails so the owner + family are free
// even before an org row exists. Comma-separated; owner email defaults in.
const OWNER_EMAIL_DEFAULT = "tmmtautodetail@gmail.com";

export function freeForeverEmails(): string[] {
  const raw = process.env.MONEY_METER_FREE_FOREVER_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.includes(OWNER_EMAIL_DEFAULT)) list.push(OWNER_EMAIL_DEFAULT);
  return list;
}

/** True if this email is owner/family — never billed, anywhere. */
export function isFreeForever(email: string | null | undefined): boolean {
  if (!email) return false;
  return freeForeverEmails().includes(email.trim().toLowerCase());
}

// ── Server wrappers (service-role only) ──────────────────────────────────────
export type RecordArgs = {
  orgId?: string | null;
  direction: MoneyDirection;
  category: MoneyCategory | string;
  amountUsd: number;
  source?: string | null;
  ref?: string | null;
  dedupeKey?: string | null;
  meta?: Record<string, unknown> | null;
};

export type RecordResult =
  | { recorded: true; id: number; billable: boolean }
  | { recorded: false; reason: "duplicate" };

/**
 * Record one money event. Idempotent when a dedupeKey is given (webhook/retry
 * safe). The DB stamps `billable = false` for 'used' events on free-forever
 * orgs. Service-role only — never call from an anon/SSR client.
 */
export async function recordMoneyEvent(
  supabase: SupabaseClient,
  args: RecordArgs
): Promise<RecordResult> {
  const { data, error } = await supabase.rpc("money_meter_record", {
    p_org: args.orgId ?? null,
    p_direction: args.direction,
    p_category: args.category,
    p_amount: args.amountUsd,
    p_source: args.source ?? null,
    p_ref: args.ref ?? null,
    p_dedupe: args.dedupeKey ?? null,
    p_meta: args.meta ?? null,
  });
  if (error) throw new Error(`money_meter_record failed: ${error.message}`);
  return data as RecordResult;
}

/**
 * Recording money must NEVER break the caller's real work (serving a chat,
 * syncing a payment). This swallows+logs failures and returns null instead of
 * throwing. Use it at instrumentation call sites; use recordMoneyEvent when a
 * failure should surface.
 */
export async function recordMoneyEventSafe(
  supabase: SupabaseClient,
  args: RecordArgs
): Promise<RecordResult | null> {
  try {
    return await recordMoneyEvent(supabase, args);
  } catch (e) {
    console.error("money-meter: record failed (non-fatal)", { category: args.category, error: (e as Error).message });
    return null;
  }
}

/**
 * Accurate top-line totals, summed in SQL (no PostgREST row cap) and RLS-scoped
 * to the caller. Prefer this over summarizeMoney(getMoneyEvents(...)) for the
 * dashboard — the latter is capped at ~1000 rows and under-reports at scale.
 */
export async function getMoneySummary(
  supabase: SupabaseClient,
  opts: { since?: string | null } = {}
): Promise<MoneySummary> {
  const { data, error } = await supabase.rpc("money_meter_summary", { p_since: opts.since ?? null });
  if (error) throw new Error(`money_meter_summary failed: ${error.message}`);
  const d = (data ?? {}) as Partial<MoneySummary>;
  const collected = Number(d.collected ?? 0);
  const usedBillable = Number(d.usedBillable ?? 0);
  const usedAll = Number(d.usedAll ?? 0);
  const saved = Number(d.saved ?? 0);
  return {
    collected,
    usedBillable,
    usedAll,
    saved,
    freeForeverValue: usedAll - usedBillable,
    net: collected - usedBillable,
  };
}

type CategoryRow = { category: string; collected: number; used_billable: number; used_all: number; saved: number };

/** Accurate per-category totals, summed in SQL (no row cap), RLS-scoped. */
export async function getMoneySummaryByCategory(
  supabase: SupabaseClient,
  opts: { since?: string | null } = {}
): Promise<CategoryBreakdown[]> {
  const { data, error } = await supabase.rpc("money_meter_summary_by_category", { p_since: opts.since ?? null });
  if (error) throw new Error(`money_meter_summary_by_category failed: ${error.message}`);
  return ((data as CategoryRow[]) ?? []).map((r) => ({
    category: r.category,
    collected: Number(r.collected ?? 0),
    usedBillable: Number(r.used_billable ?? 0),
    usedAll: Number(r.used_all ?? 0),
    saved: Number(r.saved ?? 0),
  }));
}

/**
 * Read the raw ledger (e.g. a detail list). RLS scopes it to the caller.
 * NOTE: row-capped — do NOT sum this for totals; use getMoneySummary instead.
 */
export async function getMoneyEvents(
  supabase: SupabaseClient,
  opts: { orgId?: string | null; since?: string | null; limit?: number } = {}
): Promise<MoneyEvent[]> {
  let q = supabase
    .from("money_meter_events")
    .select("org_id, direction, category, amount_usd, billable, source, ref, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 5000);
  if (opts.orgId) q = q.eq("org_id", opts.orgId);
  if (opts.since) q = q.gte("occurred_at", opts.since);
  const { data, error } = await q;
  if (error) throw new Error(`getMoneyEvents failed: ${error.message}`);
  return (data as MoneyEvent[]) ?? [];
}

/**
 * Designate an org as free-forever (owner + family). Service-role only.
 *
 * "Free forever" spans BOTH meters: money (billable=false on 'used' events) AND
 * TMMT tokens. So this also flips the org's token balance to `unlimited` — an
 * update-then-insert that never clobbers an existing balance/allotment.
 */
export async function setOrgFreeForever(
  supabase: SupabaseClient,
  orgId: string,
  label?: string
): Promise<void> {
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("money_meter_accounts")
    .upsert({ org_id: orgId, free_forever: true, label: label ?? null, updated_at: nowIso });
  if (error) throw new Error(`setOrgFreeForever failed: ${error.message}`);

  // Also make them unlimited in TMMT tokens. Update first (leaves balance/
  // allotment untouched); insert a fresh unlimited row only if none exists.
  const { data: updated, error: updErr } = await supabase
    .from("tmmt_token_balances")
    .update({ unlimited: true, updated_at: nowIso })
    .eq("org_id", orgId)
    .select("org_id");
  if (updErr) throw new Error(`setOrgFreeForever (token unlimited) failed: ${updErr.message}`);

  if (!updated || updated.length === 0) {
    const { error: insErr } = await supabase.from("tmmt_token_balances").insert({
      org_id: orgId,
      balance: 0,
      monthly_allotment: 0,
      plan_tier: "free_forever",
      unlimited: true,
      status: "active",
    });
    if (insErr) throw new Error(`setOrgFreeForever (token unlimited insert) failed: ${insErr.message}`);
  }
}

/**
 * Reconcile the env allowlist (MONEY_METER_FREE_FOREVER_EMAILS) into the DB — the
 * durable source of truth. If `email` is free-forever but its org isn't marked
 * yet, mark it (money + tokens). Idempotent no-op otherwise. Call at a runtime
 * point where both the actor email and their org id are known (e.g. Pocket chat),
 * so env-listed owner/family accounts actually stop being metered. Service-role only.
 */
export async function reconcileFreeForeverByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
  orgId: string
): Promise<boolean> {
  if (!isFreeForever(email)) return false;
  await setOrgFreeForever(supabase, orgId, "free-forever (email allowlist)");
  return true;
}
