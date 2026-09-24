import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase-server";
import { safeRelativePath } from "@/lib/safe-redirect";

/**
 * Auth redirect callback for the PKCE flow (password recovery, magic links).
 * Supabase emails a link to `…/api/auth/callback?code=<pkce>&next=<path>`.
 * We exchange the one-time code for a session (written to cookies) and then
 * forward the user to `next` so they can complete the flow (e.g. set a new
 * password on /login/reset). Public path — middleware must not gate it, since
 * the user has no session until this exchange completes.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  // Only same-app paths, never an attacker-supplied destination — including the
  // "/\evil.com" and "/<tab>/evil.com" forms the old prefix check let through (C3-003).
  const safeNext = safeRelativePath(searchParams.get("next"), "/login/reset");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  }

  const supabase = await createSSRClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] code exchange failed:", error.message);
    return NextResponse.redirect(new URL("/login?error=expired_link", origin));
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
