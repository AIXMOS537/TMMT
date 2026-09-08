import { NextResponse } from "next/server";
import { z } from "zod";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import {
  spendTokens,
  grantTokens,
  resolveOrgIdByEmail,
  COST_PER_JOB,
} from "@/lib/token-ledger";
import { askPocketBrain } from "@/lib/pocket-brain";
import { enforceCompliance } from "@/lib/compliance";
import { isRateLimitedDurable, type RateLimitBackend } from "@/lib/rate-limit-durable";
import { recordMoneyEventSafe, reconcileFreeForeverByEmail } from "@/lib/money-meter";

export const runtime = "nodejs";

// What one Pocket job would have cost on a cloud model. We serve it on the
// OWNER'S local brain instead, so the money meter books this as money SAVED.
// Tunable via env (no code change); default ~2¢/job matches docs/COST-AND-CAPACITY.md.
const CLOUD_EQUIV_USD_PER_JOB = (() => {
  const n = Number(process.env.POCKET_CLOUD_EQUIV_USD);
  return Number.isFinite(n) && n >= 0 ? n : 0.02;
})();

// AIXMOS Pocket assistant — metered in TMMT TOKENS, served by the OWNER'S brain.
// No Anthropic at runtime. The $97/mo membership tops up the org's token stack
// (src/lib/token-ledger.ts); each message spends from it. Owner + first-10
// operators are `unlimited` and never metered.

const BodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      })
    )
    .max(12)
    .optional(),
});

function err(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(request: Request) {
  // 1. Validate input.
  let message: string;
  let history: { role: "user" | "assistant"; content: string }[] | undefined;
  try {
    ({ message, history } = BodySchema.parse(await request.json()));
  } catch {
    return err(400, "Send a message (1–2000 characters).");
  }

  // 2. Auth — must be a signed-in member.
  let email: string | null = null;
  try {
    const supabase = await createSSRClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err(401, "Please sign in.");
    email = user.email ?? null;
  } catch {
    return err(401, "Please sign in.");
  }
  if (!email) return err(403, "Your account has no email on file.");

  // 3. Per-member burst limit (cheap abuse guard on top of the token meter).
  //    Shared across instances once the rate_limit_hit RPC exists.
  let limiter: RateLimitBackend | null = null;
  try { limiter = createServiceRoleClient(); } catch { limiter = null; }
  if (await isRateLimitedDurable(`pocket-chat:${email}`, { windowMs: 60_000, maxHits: 20 }, limiter)) {
    return err(429, "Slow down a moment, then try again.");
  }

  // 3b. If the brain isn't configured, fail BEFORE spending a token (keeps the
  // ledger clean — no spurious spend+refund pair in the audit trail).
  if (!process.env.POCKET_BRAIN_URL) {
    return err(503, "The coach is warming up — check back shortly.");
  }

  // 4. Resolve the member's org (the token account lives per-org).
  const service = createServiceRoleClient();
  const orgId = await resolveOrgIdByEmail(service, email);
  if (!orgId) {
    return err(402, "Activate your membership to use the coach.", {
      reason: "no_membership",
    });
  }

  // 4b. Free-forever reconcile: if this member's email is on the owner/family
  // allowlist (MONEY_METER_FREE_FOREVER_EMAILS) but their org isn't marked yet,
  // mark it now — money + tokens — BEFORE spending, so they're never metered.
  // Best-effort; a hiccup here must not block the chat.
  try {
    await reconcileFreeForeverByEmail(service, email, orgId);
  } catch (e) {
    console.error("pocket/chat: free-forever reconcile failed (non-fatal)", {
      error: (e as Error).message,
    });
  }

  // 5. SPEND a TMMT token (atomic; owner/operators are unlimited).
  const spend = await spendTokens(service, { orgId, jobRef: "pocket-chat" });
  if (!spend.allowed) {
    const msg =
      spend.reason === "insufficient"
        ? "You're out of TMMT tokens — top up or renew to keep coaching."
        : spend.reason === "suspended"
          ? "Your membership is paused. Reactivate to continue."
          : "Activate your membership to use the coach.";
    return err(402, msg, { reason: spend.reason, balance: spend.balance });
  }

  // 6. Serve from the OWNER'S brain. On failure, refund the token (unless unlimited).
  const brain = await askPocketBrain({ userMessage: message, history });
  if (!brain.ok) {
    if (!spend.unlimited) {
      try {
        await grantTokens(service, {
          orgId,
          amount: COST_PER_JOB,
          reason: `refund: brain_${brain.error ?? "error"}`,
        });
      } catch {
        /* refund is best-effort; the failure is already logged below */
      }
    }
    console.error("pocket/chat: brain unavailable", { error: brain.error });
    return err(503, "The coach is catching its breath — try again in a moment.", {
      reason: brain.error,
    });
  }

  // 7. Compliance guard before anything reaches the member.
  const safe = enforceCompliance(brain.text);
  if (safe.violations.length > 0) {
    console.warn("pocket/chat: compliance guard fired", {
      violations: safe.violations,
      blocked: safe.blocked,
    });
  }

  // Money meter: serving on the owner's local brain avoided a cloud API charge.
  // Best-effort — a metering hiccup must never fail a member's chat.
  await recordMoneyEventSafe(service, {
    orgId,
    direction: "saved",
    category: "ai_llm",
    amountUsd: CLOUD_EQUIV_USD_PER_JOB,
    source: "pocket-chat",
    meta: { reason: "local_inference_vs_cloud" },
  });

  return NextResponse.json({
    reply: safe.text,
    balance: spend.balance,
    unlimited: spend.unlimited ?? false,
  });
}
