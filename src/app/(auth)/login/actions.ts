"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getTierForUser, homePathForTier } from "@/lib/auth-roles";
import { isRateLimitedDurable, type RateLimitBackend } from "@/lib/rate-limit-durable";
import {
  hashInviteCode,
  inviteRejection,
  isMalformedInviteCode,
  type InviteRow,
} from "@/lib/signup-invite";

/**
 * One message for every way a code can fail. A stranger probing the form must
 * not be able to tell "no such code" from "already used" from "not your email"
 * — that difference is how you enumerate valid codes.
 */
const BAD_INVITE = "That invite code isn't valid. Ask TMMT for a new one.";

function clientIp(h: { get(name: string): string | null }): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** audit_events.ip is inet — anything that is not an address must go in as null. */
function inetOrNull(ip: string): string | null {
  return /^[0-9a-fA-F.:]+$/.test(ip) && ip !== "unknown" ? ip : null;
}

/** Shared rate-limit counter when the service client is available; never fatal. */
function limiterBackend(): RateLimitBackend | null {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

async function auditSignup(action: string, ip: string, payload: Record<string, unknown>) {
  // Best-effort. A failure to write the log must never block or break sign-up.
  try {
    const admin = createServiceRoleClient();
    await admin.from("audit_events").insert({ action, ip: inetOrNull(ip), payload });
  } catch {
    /* logging is not load-bearing */
  }
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "");

  const h = await headers();
  const ip = clientIp(h);

  // Throttle before doing any work. Public endpoint, real database behind it.
  if (await isRateLimitedDurable(`signup:${ip}`, { windowMs: 60 * 60 * 1000, maxHits: 10 }, limiterBackend())) {
    return { error: "Too many attempts. Try again later." };
  }

  if (!email || password.length < 8) {
    return { error: "Use a real email and a password of at least 8 characters." };
  }

  // Cheap shape check — an empty or stubby code never reaches the database.
  if (isMalformedInviteCode(inviteCode)) {
    await auditSignup("signup.invite_rejected", ip, { email, reason: "malformed" });
    return { error: BAD_INVITE };
  }

  // FAIL CLOSED. If the service-role client cannot be built (missing env) or the
  // invites table is unreachable, nobody gets an account. Never fall through to
  // an open sign-up because the gate itself is broken.
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (err) {
    console.error("[register] invite gate unavailable:", err);
    return { error: "Sign-up is unavailable right now. Contact TMMT." };
  }

  const codeHash = hashInviteCode(inviteCode);

  const { data: found, error: lookupError } = await admin
    .from("signup_invites")
    .select("id, email, expires_at, used_at")
    .eq("code_hash", codeHash)
    .maybeSingle<InviteRow>();

  if (lookupError) {
    console.error("[register] invite lookup failed:", lookupError.message);
    return { error: "Sign-up is unavailable right now. Contact TMMT." };
  }

  const rejection = inviteRejection(found, email);
  if (rejection || !found) {
    console.warn(`[register] invite refused (${rejection}) for ${email} from ${ip}`);
    await auditSignup("signup.invite_rejected", ip, { email, reason: rejection });
    return { error: BAD_INVITE };
  }

  // Claim it. One conditional UPDATE — `used_at is null` in the WHERE means two
  // requests racing on the same code cannot both come back with a row.
  const { data: claimed, error: claimError } = await admin
    .from("signup_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", found.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (claimError || !claimed) {
    console.warn(`[register] invite claim lost the race for ${email} from ${ip}`);
    await auditSignup("signup.invite_rejected", ip, { email, reason: "race" });
    return { error: BAD_INVITE };
  }

  const releaseClaim = async () => {
    // Sign-up failed after we burned the code — hand it back so a typo'd
    // password does not cost the person their invite.
    const { error } = await admin.from("signup_invites").update({ used_at: null }).eq("id", claimed.id);
    if (error) console.error("[register] could not release invite:", error.message);
  };

  const supabase = await createSSRClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || email } },
  });

  if (error) {
    console.error("[register] failed:", error.message);
    await releaseClaim();
    return { error: "Could not create that login. Try signing in, or use another email." };
  }

  await admin.from("signup_invites").update({ used_by: data.user?.id ?? null }).eq("id", claimed.id);
  await auditSignup("signup.invite_redeemed", ip, { email, invite_id: claimed.id });

  if (!data.user) {
    return { error: "Check your email to confirm the account, then sign in." };
  }

  redirect(homePathForTier(getTierForUser(data.user)));
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const h = await headers();
  const ip = clientIp(h);
  if (await isRateLimitedDurable(`signin:${ip}`, { windowMs: 15 * 60 * 1000, maxHits: 20 }, limiterBackend())) {
    return { error: "Too many attempts. Try again later." };
  }

  const supabase = await createSSRClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[login] auth failed:", error.message);
    return { error: "Invalid email or password." };
  }

  redirect(homePathForTier(getTierForUser(data.user)));
}
