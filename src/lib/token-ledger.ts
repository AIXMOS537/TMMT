import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TMMT Token Ledger — the "genie meter".
 *
 * $97/mo tops up an org's monthly token stack; each engine job spends tokens.
 * Owner + first-10 operators carry `unlimited = true` and are never metered.
 *
 * This module is the thin, typed server-side wrapper around the two SECURITY
 * DEFINER functions defined in
 *   supabase/migrations/20260619010000_tmmt_token_ledger.sql
 * — `tmmt_token_grant` (idempotent top-up) and `tmmt_token_spend` (atomic meter).
 * Both are revoked from PUBLIC and granted to `service_role` only, so every
 * call here MUST use a service-role client (never the anon/SSR client).
 *
 * Spec: docs/superpowers/specs/2026-06-18-tmmt-token-ledger.md
 */

// ── Owner-tunable economics (v0) ────────────────────────────────────────────
// Flat 1 token per engine job to start (real per-job/per-model pricing later).
export const COST_PER_JOB = 1;

// Monthly stack a $97 member receives. This is the per-member job cap for the
// month and the lever that caps engine/API cost per paying user. Tune freely.
export const MEMBER_97_MONTHLY_TOKENS = 500;

/** Which paid tags grant tokens, and how much. v0 = the $97 membership only. */
type TokenGrantPlan = { tokens: number; tier: string; reason: string };
const TOKEN_GRANT_TAGS: Record<string, TokenGrantPlan> = {
  "member-97": {
    tokens: MEMBER_97_MONTHLY_TOKENS,
    tier: "member",
    reason: "member-97 monthly top-up",
  },
};

/** The token grant plan for a tag, or null if the tag doesn't grant tokens. */
export function tokenGrantForTag(tag: string): TokenGrantPlan | null {
  return TOKEN_GRANT_TAGS[tag] ?? null;
}

/** First tag in the list that grants tokens (or null). */
export function firstGrantTag(tags: string[]): string | null {
  return tags.find((t) => t in TOKEN_GRANT_TAGS) ?? null;
}

/**
 * Idempotency key for a top-up. A real transaction id makes every legit
 * recurring charge grant exactly once. With no transaction id we fall back to a
 * per-email, per-month key so a given member is topped up at most once a month
 * (retries/duplicate webhooks can't double-credit).
 */
export function topupDedupeKey(
  tag: string,
  email: string,
  paymentRef: string | null,
  now: Date = new Date()
): string {
  if (paymentRef) return `ghl-topup:${paymentRef}`;
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  return `${tag}:${email.trim().toLowerCase()}:${month}`;
}

// ── RPC return shapes (mirror the SQL functions) ────────────────────────────
export type GrantResult = { granted: boolean; balance: number; reason?: string };
export type SpendResult = {
  allowed: boolean;
  balance: number;
  unlimited?: boolean;
  reason?: "no_account" | "suspended" | "insufficient";
};

/**
 * Resolve a paying customer's email to their org id via `profiles`. Returns
 * null when the email isn't tied to an org yet (e.g. a brand-new member who
 * hasn't been provisioned) — callers treat that as "nothing to top up".
 */
export async function resolveOrgIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const clean = email.trim();
  if (!clean) return null;
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .ilike("email", clean)
    .not("organization_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const orgId = data?.[0]?.organization_id;
  return typeof orgId === "string" ? orgId : null;
}

/** Idempotent token grant (top-up). Service-role only. */
export async function grantTokens(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    amount: number;
    reason: string;
    dedupeKey?: string | null;
    setAllotment?: number | null;
    tier?: string | null;
  }
): Promise<GrantResult> {
  const { data, error } = await supabase.rpc("tmmt_token_grant", {
    p_org: args.orgId,
    p_amount: args.amount,
    p_reason: args.reason,
    p_dedupe: args.dedupeKey ?? null,
    p_set_allotment: args.setAllotment ?? null,
    p_tier: args.tier ?? null,
  });
  if (error) throw new Error(`tmmt_token_grant failed: ${error.message}`);
  return data as GrantResult;
}

/** Atomic token spend (the meter). Service-role only. */
export async function spendTokens(
  supabase: SupabaseClient,
  args: { orgId: string; cost?: number; jobRef?: string | null }
): Promise<SpendResult> {
  const { data, error } = await supabase.rpc("tmmt_token_spend", {
    p_org: args.orgId,
    p_cost: args.cost ?? COST_PER_JOB,
    p_job: args.jobRef ?? null,
  });
  if (error) throw new Error(`tmmt_token_spend failed: ${error.message}`);
  return data as SpendResult;
}

/** Read an org's current balance row (null if it has no token account). */
export async function getTokenBalance(
  supabase: SupabaseClient,
  orgId: string
): Promise<{
  balance: number;
  monthly_allotment: number;
  plan_tier: string;
  unlimited: boolean;
  status: string;
} | null> {
  const { data } = await supabase
    .from("tmmt_token_balances")
    .select("balance, monthly_allotment, plan_tier, unlimited, status")
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as {
    balance: number;
    monthly_allotment: number;
    plan_tier: string;
    unlimited: boolean;
    status: string;
  } | null) ?? null;
}

export type TopupOutcome =
  | { topped_up: true; tag: string; org_id: string; balance: number; granted: boolean }
  | { topped_up: false; reason: "no_grant_tag" | "no_org" };

/**
 * Top up an org's tokens off a recorded payment. Best-effort and idempotent:
 * a payment that doesn't map to a token-granting tag, or whose email isn't tied
 * to an org yet, is a no-op (never throws to the webhook for those cases).
 *
 * Call AFTER the payment row is recorded. The dedupe key keeps webhook retries
 * and duplicate deliveries from double-crediting.
 */
export async function grantMonthlyTokensForPayment(
  supabase: SupabaseClient,
  args: { email: string; tags: string[]; paymentRef: string | null; now?: Date }
): Promise<TopupOutcome> {
  const tag = firstGrantTag(args.tags);
  if (!tag) return { topped_up: false, reason: "no_grant_tag" };

  const plan = tokenGrantForTag(tag)!;
  const orgId = await resolveOrgIdByEmail(supabase, args.email);
  if (!orgId) return { topped_up: false, reason: "no_org" };

  const result = await grantTokens(supabase, {
    orgId,
    amount: plan.tokens,
    reason: plan.reason,
    dedupeKey: topupDedupeKey(tag, args.email, args.paymentRef, args.now),
    setAllotment: plan.tokens,
    tier: plan.tier,
  });

  return {
    topped_up: true,
    tag,
    org_id: orgId,
    balance: result.balance,
    granted: result.granted,
  };
}
