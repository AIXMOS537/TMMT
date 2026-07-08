import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getTierForUser, homePathForTier, type AccessTier } from "@/lib/auth-roles";
import { isOwnerHubHost } from "@/lib/site-domains";

/** Revenue funnel + webhook surfaces — must stay public (ad loop, GHL, Twilio, dealer demos). */
function isFunnelPublicPath(pathname: string) {
  return (
    pathname === "/join" ||
    pathname === "/dealers" ||
    pathname === "/credit" ||
    pathname === "/funding" ||
    pathname.startsWith("/lp/") ||
    pathname.startsWith("/api/leads/") ||
    pathname === "/api/health" ||
    pathname === "/api/agent/health" ||
    pathname === "/api/agent/_health" ||
    pathname.startsWith("/api/agent/sms/") ||
    pathname.startsWith("/api/agent/stripe/webhook/") ||
    pathname.startsWith("/api/agent/cal/webhook/")
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/robots.txt" ||
    pathname === "/offline" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/kits" ||
    pathname === "/build" ||
    pathname === "/explainer" ||
    pathname.startsWith("/build/") ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/agent/") ||
    isFunnelPublicPath(pathname)
  );
}

/** Pitch + webhook routes — never run Supabase auth (avoids 307→/login on demos). */
function isPitchPublicPath(pathname: string) {
  return (
    pathname === "/robots.txt" ||
    pathname === "/kits" ||
    pathname === "/build" ||
    pathname === "/dealers" ||
    pathname === "/explainer" ||
    pathname.startsWith("/build/") ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/agent/") ||
    isFunnelPublicPath(pathname)
  );
}

function pathAllowedForTier(pathname: string, tier: AccessTier): boolean {
  if (isPublicPath(pathname)) return true;

  // Time clock is available to every signed-in employee, whatever their tier.
  if (pathname === "/clock" || pathname.startsWith("/clock/")) return true;

  // AIXMOS Pocket — the member's pocket app + its API, available to every
  // signed-in user whatever their tier (member, operator, owner). The API
  // routes do their own auth + token metering. See docs/aixmos-pocket.
  if (pathname === "/pocket" || pathname.startsWith("/pocket/")) return true;
  if (pathname.startsWith("/api/pocket/")) return true;

  switch (tier) {
    case "owner":
      return true;
    case "executive":
      return pathname.startsWith("/executive");
    case "operator":
      return pathname.startsWith("/operator");
    case "vendor":
      return pathname.startsWith("/vendor");
    case "investor":
      return pathname.startsWith("/investor") || pathname.startsWith("/partner");
    default:
      return (
        !pathname.startsWith("/vendor") &&
        !pathname.startsWith("/investor") &&
        !pathname.startsWith("/partner") &&
        !pathname.startsWith("/command") &&
        !pathname.startsWith("/executive") &&
        !pathname.startsWith("/operator")
      );
  }
}

export async function middleware(request: NextRequest) {
  const withRobotsHeader = (res: NextResponse): NextResponse => {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  };

  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const ownerHub = isOwnerHubHost(host);

  if (pathname.startsWith("/forms") && request.method === "POST") {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return withRobotsHeader(
        NextResponse.json(
          { error: "Too many submissions. Please try again later." },
          { status: 429 }
        )
      );
    }
  }

  if (isPitchPublicPath(pathname)) {
    return withRobotsHeader(NextResponse.next({ request }));
  }

  const response = NextResponse.next({ request });
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  // Auth gate. If Supabase is unreachable or misconfigured (e.g. a preview
  // deploy missing env vars), FAIL CLOSED: treat the request as signed-out so
  // protected routes redirect to /login and public routes still render — never
  // a 500, and never accidentally granting access.
  let user: User | null = null;
  try {
    const supabase = createMiddlewareClient(request, response);
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (err) {
    console.error("middleware: Supabase auth check failed; treating as signed-out", err);
  }

  if (!user && !isPublicPath(pathname)) {
    return withRobotsHeader(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (user && pathname === "/login") {
    const tier = getTierForUser(user);
    if (ownerHub) {
      if (tier === "owner") {
        return withRobotsHeader(
          NextResponse.redirect(new URL("/command", request.url))
        );
      }
      return withRobotsHeader(
        NextResponse.redirect(new URL("/login?hub=owner", request.url))
      );
    }
    return withRobotsHeader(
      NextResponse.redirect(new URL(homePathForTier(tier), request.url))
    );
  }

  if (ownerHub && user && getTierForUser(user) !== "owner") {
    return withRobotsHeader(
      NextResponse.redirect(new URL("/login?hub=owner", request.url))
    );
  }

  if (ownerHub && user && pathname === "/") {
    return withRobotsHeader(NextResponse.redirect(new URL("/command", request.url)));
  }

  if (user && !pathAllowedForTier(pathname, getTierForUser(user))) {
    return withRobotsHeader(
      NextResponse.redirect(new URL(homePathForTier(getTierForUser(user)), request.url))
    );
  }

  if (pathname.startsWith("/partner")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/partner/, "/investor") || "/investor";
    return withRobotsHeader(NextResponse.redirect(url));
  }

  return withRobotsHeader(response);
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html|cmd|ps1|gz|sh|txt)$).*)",
  ],
};
