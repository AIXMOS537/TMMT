import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AIXMOS Pocket referrals — the "earn" half of learn-earn-churn.
 *
 * PROTECTIVE STRUCTURE (owner = Muhammad Taha):
 *  - SINGLE-TIER only — no recruiting-on-recruiting, no MLM depth.
 *  - Commission is recorded ONLY on COLLECTED sales. No guaranteed/passive income.
 *  - Internal earnings records — not a security, not crypto.
 *
 * Tables (RLS read-own; service-role writes only):
 *   supabase/migrations/20260619020000_pocket_referrals.sql
 *
 * All write calls here MUST use a service-role client.
 */

/** Commission paid to the referrer on a collected sale. Owner-tunable. */
export const REFERRAL_RATE = (() => {
  const raw = Number(process.env.POCKET_REFERRAL_RATE);
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : 0.2; // default 20%
})();

/** Commission (2-dp) on a collected sale amount. Never negative. */
export function commissionFor(saleAmount: number, rate: number = REFERRAL_RATE): number {
  if (!Number.isFinite(saleAmount) || saleAmount <= 0) return 0;
  return Math.round(saleAmount * rate * 100) / 100;
}

/** Stable, human-ish referral code from an email (deterministic; uppercase base36). */
export function deriveReferralCode(email: string): string {
  const s = email.trim().toLowerCase();
  // djb2 hash → base36, padded. Stable for the same email across runs.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(0, 7);
}

/** Get the member's referral code, creating it once if needed. Service-role only. */
export async function getOrCreateReferralCode(
  supabase: SupabaseClient,
  args: { email: string; userId?: string | null }
): Promise<string> {
  const email = args.email.trim();
  const { data: existing } = await supabase
    .from("pocket_referral_codes")
    .select("code")
    .ilike("owner_email", email)
    .limit(1);
  if (existing?.[0]?.code) return existing[0].code as string;

  // Create. On a code collision (rare), retry once with a short suffix.
  let code = deriveReferralCode(email);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from("pocket_referral_codes").insert({
      code,
      owner_email: email,
      owner_user_id: args.userId ?? null,
    });
    if (!error) return code;
    // Lost a race on owner_email? Re-read and return whatever's there.
    const { data: again } = await supabase
      .from("pocket_referral_codes")
      .select("code")
      .ilike("owner_email", email)
      .limit(1);
    if (again?.[0]?.code) return again[0].code as string;
    code = `${deriveReferralCode(email)}${Math.floor(Math.random() * 90 + 10)}`;
  }
  return code;
}

/**
 * Idempotency key for an earning. A real transaction ref makes every legit sale
 * credit exactly once. With no ref we fall back to a per-code, per-referred,
 * per-amount, per-month key so a webhook retry can't double-pay a commission.
 * (Postgres treats NULL as distinct on the unique index, so we must never store
 * NULL for an unreffed sale.)
 */
export function referralDedupeKey(
  code: string,
  referredEmail: string | null | undefined,
  saleAmount: number,
  paymentRef: string | null | undefined,
  now: Date = new Date()
): string {
  if (paymentRef) return `ref:${paymentRef}`;
  const who = (referredEmail ?? "").trim().toLowerCase() || "anon";
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  return `ref:${code}:${who}:${saleAmount}:${month}`;
}

export type ReferralRecordOutcome =
  | { recorded: true; commission: number }
  | { recorded: false; reason: "unknown_code" | "no_amount" | "duplicate" | "error" | "self_referral" };

/**
 * Record a COLLECTED referral sale → the referrer's commission. Idempotent on
 * paymentRef. Best-effort: an unknown code or zero amount is a clean no-op.
 */
export async function recordCollectedReferral(
  supabase: SupabaseClient,
  args: {
    code: string;
    referredEmail?: string | null;
    saleAmount: number;
    paymentRef?: string | null;
    rate?: number;
  }
): Promise<ReferralRecordOutcome> {
  const code = args.code.trim();
  if (!code) return { recorded: false, reason: "unknown_code" };
  if (!args.saleAmount || args.saleAmount <= 0) return { recorded: false, reason: "no_amount" };

  // The code must belong to a real member.
  const { data: codeRow } = await supabase
    .from("pocket_referral_codes")
    .select("code, owner_email")
    .eq("code", code)
    .limit(1);
  if (!codeRow?.[0]) return { recorded: false, reason: "unknown_code" };

  // No self-dealing: a code never earns on its own owner's purchase.
  const ownerEmail = String((codeRow[0] as { owner_email?: string }).owner_email ?? "").trim().toLowerCase();
  const buyer = (args.referredEmail ?? "").trim().toLowerCase();
  if (ownerEmail && buyer && ownerEmail === buyer) {
    return { recorded: false, reason: "self_referral" };
  }

  const commission = commissionFor(args.saleAmount, args.rate);
  const { error } = await supabase.from("pocket_referral_earnings").insert({
    code,
    referred_email: args.referredEmail ?? null,
    sale_amount: args.saleAmount,
    commission,
    status: "collected",
    // Never NULL — synthesize a stable key so retries can't double-pay.
    payment_ref: referralDedupeKey(code, args.referredEmail, args.saleAmount, args.paymentRef),
  });
  if (error) {
    // Unique violation on payment_ref => already recorded (idempotent).
    if (/duplicate key|unique/i.test(error.message)) return { recorded: false, reason: "duplicate" };
    return { recorded: false, reason: "error" };
  }
  return { recorded: true, commission };
}

export interface ReferralSummary {
  code: string;
  collectedTotal: number;
  collectedCount: number;
}

/** A member's earnings summary — collected commission NET of clawbacks. */
export async function getReferralSummary(
  supabase: SupabaseClient,
  code: string
): Promise<ReferralSummary> {
  const { data } = await supabase
    .from("pocket_referral_earnings")
    .select("commission, status")
    .eq("code", code);
  const rows = (data as { commission: number; status: string }[] | null) ?? [];
  let total = 0;
  let count = 0;
  for (const r of rows) {
    const c = Number(r.commission || 0);
    if (r.status === "collected") {
      total += c;
      count += 1;
    } else if (r.status === "clawed_back") {
      total -= c;
    }
  }
  return {
    code,
    collectedTotal: Math.max(0, Math.round(total * 100) / 100),
    collectedCount: count,
  };
}

/**
 * Claw back a referral commission on a refund/chargeback. Writes a compensating
 * 'clawed_back' row (idempotent on its own ref). Best-effort.
 */
export async function clawbackReferral(
  supabase: SupabaseClient,
  args: { code: string; saleAmount: number; paymentRef: string; rate?: number }
): Promise<{ clawed: boolean }> {
  const code = args.code.trim();
  if (!code || !args.paymentRef) return { clawed: false };
  const commission = commissionFor(args.saleAmount, args.rate);
  const { error } = await supabase.from("pocket_referral_earnings").insert({
    code,
    sale_amount: args.saleAmount,
    commission,
    status: "clawed_back",
    payment_ref: `clawback:${args.paymentRef}`,
  });
  return { clawed: !error };
}
