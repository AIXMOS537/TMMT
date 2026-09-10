import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getTierForUser, homePathForTier, type AccessTier } from "@/lib/auth-roles";
import { isOwnerHubHost } from "@/lib/site-domains";
import { TENANT_HEADER, resolveTenant, OPS_FALLBACK_SLUG, normalizeHost } from "@/lib/platform/tenant-resolve";
import { ORG_HEADER, HOST_HEADER, orgIdForHostStatic } from "@/lib/platform/tenant-org";

/** Revenue funnel + webhook surfaces — must stay public (ad loop, GHL, Twilio, dealer demos). */
function isFunnelPublicPath(pathname: string) {
  return (
    pathname === "/join" ||
    pathname === "/try" ||
    pathname === "/upgrade" ||
    pathname === "/dealers" ||
    pathname === "/credit" ||
    pathname === "/funding" ||
    // The opt-in referral page. Public on purpose: it is where someone
    // chooses to be introduced to the partner, and it must be reachable
    // without an account. It is also the only page allowed to link out.
    pathname === "/partners/all-in-one" ||
    pathname.startsWith("/partners/all-in-one/") ||
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

/**
 * Where a signed-in account with no role lands (homePathForTier("none")), and
 * where a signed-in non-owner lands on the owner hub (?hub=owner). Public on
 * purpose: it is the one page every session state can reach, so no deny rule
 * below can ever redirect to a path that is itself denied. A stale or
 * half-expired session therefore ends on a message, never in a redirect loop.
 */
const NO_ACCESS_PATH = "/no-access";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === NO_ACCESS_PATH ||
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
    pathname.startsWith("/api/forms/") ||
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
    pathname.startsWith("/api/forms/") ||
    pathname.startsWith("/api/agent/") ||
    isFunnelPublicPath(pathname)
  );
}

/** Same rentals desk Khan Strategies uses — customers, fleet, tickets, the lot. */
function isRentalsDeskPath(pathname: string): boolean {
  return (
    !pathname.startsWith("/vendor") &&
    !pathname.startsWith("/investor") &&
    !pathname.startsWith("/partner") &&
    !pathname.startsWith("/command") &&
    !pathname.startsWith("/executive") &&
    !pathname.startsWith("/operator") &&
    // Money Meter = business-wide financial telemetry. Owner-only (its ledger
    // has org-member RLS, so a non-owner member could otherwise see their
    // own org's used/saved). Owner tier returns true above; everyone else is
    // redirected to their home.
    !pathname.startsWith("/money")
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
  if (pathname.startsWith("/api/offline/")) return true;

  switch (tier) {
    case "owner":
      return true;
    case "executive":
      return pathname.startsWith("/executive") || isRentalsDeskPath(pathname);
    case "operator":
      // "/operator" and not "/operators": the (command)/operators screens are
      // the owner's provisioning console, and a bare startsWith handed them to
      // the operator tier. Those pages re-check for themselves, so nothing
      // leaked; the rule was simply wrong, and the next thing to lean on it
      // would inherit it. Operators also get the rentals desk.
      return (
        pathname === "/operator" ||
        pathname.startsWith("/operator/") ||
        isRentalsDeskPath(pathname)
      );
    case "vendor":
      return pathname.startsWith("/vendor");
    case "investor":
      return pathname.startsWith("/investor") || pathname.startsWith("/partner");
    case "staff":
      return isRentalsDeskPath(pathname);
    case "none":
      // No recognised role: nothing beyond the public pages and the
      // everyone-surfaces handled above. This tier used to share the staff
      // line and reach the rentals desk at the edge, with only the (admin)
      // layout holding it back. Denied here now; the layout check stays as
      // defence in depth. The redirect target is /no-access (public), so "/"
      // being a desk path no longer matters.
      return false;
    default: {
      const _never: never = tier;
      return _never;
    }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const ownerHub = isOwnerHubHost(host);

  // Annotate the request with the client brand. Pure config lookup — never
  // changes auth, redirects, or tier routing below.
  const tenant = resolveTenant({
    host,
    forwardedHost: request.headers.get("x-forwarded-host"),
    pathname,
    fallbackSlug: OPS_FALLBACK_SLUG,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HEADER, tenant.slug);

  // Host-based tenancy. The brand above says what to RENDER; the org says what
  // data the request may TOUCH, and only the org is what RLS enforces.
  //
  // Only the house hosts are resolved here, from a static map — an operator's
  // domain is looked up server-side from organization_domains, because Edge
  // middleware runs on every request and must not carry a database round trip.
  // Forwarding the normalized host is what makes that later lookup possible.
  //
  // Deliberately no fallback org: an unrecognised host gets no org header at
  // all. Defaulting to the house org here would silently serve one tenant
  // another tenant's data, which is precisely what this exists to prevent.
  requestHeaders.set(HOST_HEADER, normalizeHost(host));
  const staticOrgId = orgIdForHostStatic(host);
  if (staticOrgId) requestHeaders.set(ORG_HEADER, staticOrgId);
  else requestHeaders.delete(ORG_HEADER); // never trust an inbound org header
  const nextWithTenant = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  const withRobotsHeader = (res: NextResponse): NextResponse => {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set(TENANT_HEADER, tenant.slug);
    return res;
  };

  // No automatic hand-off to the partner site.
  //
  // What used to sit here: on tmmt-ops.vercel.app / tmmtrentals.com, the paths
  // /credit, /funding, /lp/*/intro-97 and /lp/*/lead-magnet were answered with
  // a 301 to allinonemanagementsolutions.com. A 301 is permanent — browsers
  // cache it and stop asking the server — which is why the app "kept"
  // redirecting there even after a fix: the hop was in the visitor's browser,
  // not in the deploy. The /lp/* pages it threw away are real TMMT landing
  // pages whose form POSTs to our own /api/leads/webhook, so every one of
  // those visitors was a TMMT lead handed to the partner's homepage.
  //
  // Referring someone to the partner is now opt-in only and lives behind a
  // form on /partners/all-in-one. See src/lib/partner-handoff.ts.

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
    return withRobotsHeader(nextWithTenant());
  }

  const response = nextWithTenant();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set(TENANT_HEADER, tenant.slug);

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
    // Every signed-out visitor goes to /login, "/" included.
    //
    // "/" used to bounce to the public GHL site, on the assumption that staff
    // "use /login directly". That left the app with no reachable front door:
    // the owner hub host (ops.allinonemanagementsolutions.com) was never
    // created, and tmmtrentals.com resolves to nothing, so every address the
    // owner could actually type landed on marketing. Typing the app's own
    // address and being shown someone else's home page is not a front door.
    //
    // The public funnel is untouched: /credit, /funding and the /lp/* SKUs
    // are public paths that render TMMT's own pages and capture the lead
    // here. The partner site keeps its own domain and its own traffic.
    return withRobotsHeader(NextResponse.redirect(new URL("/login", request.url)));
  }

  // Owner hub: a signed-in account that is not an owner is refused everything
  // and told so on /no-access?hub=owner. It used to be sent to /login?hub=owner,
  // which — still signed in, still on /login — matched this same rule and
  // redirected to itself until the browser gave up (ERR_TOO_MANY_REDIRECTS).
  // Fail-closed, but a loop instead of a message. /no-access is public and
  // exempted below, so the target of this redirect always renders.
  const hubRefusal = () =>
    withRobotsHeader(
      NextResponse.redirect(new URL(`${NO_ACCESS_PATH}?hub=owner`, request.url))
    );

  if (user && pathname === "/login") {
    const tier = getTierForUser(user);
    if (ownerHub) {
      if (tier === "owner") {
        return withRobotsHeader(
          NextResponse.redirect(new URL("/command", request.url))
        );
      }
      return hubRefusal();
    }
    return withRobotsHeader(
      NextResponse.redirect(new URL(homePathForTier(tier), request.url))
    );
  }

  if (ownerHub && user && getTierForUser(user) !== "owner" && pathname !== NO_ACCESS_PATH) {
    return hubRefusal();
  }

  if (ownerHub && user && pathname === "/") {
    return withRobotsHeader(NextResponse.redirect(new URL("/command", request.url)));
  }

  if (user && !pathAllowedForTier(pathname, getTierForUser(user))) {
    return withRobotsHeader(
      NextResponse.redirect(new URL(homePathForTier(getTierForUser(user)), request.url))
    );
  }

  // /partner is a real portal, not an alias for /investor.
  //
  // This redirect sent every /partner request to /investor, unconditionally and
  // after the tier check had already decided the investor tier was allowed
  // through — so the allowance could never take effect and the page had never
  // rendered for anyone. /investor does not show fleet data; /partner does, via
  // the get_partner_fleet function and partner_fleet_access, both of which
  // exist and carry their own row-level security.
  //
  // The line arrived inside the commit that moved middleware.ts into src/, not
  // in a decision to retire the portal, so it reads as something carried across
  // rather than chosen. Removed. The tier rule above already limits /partner to
  // the investor tier, and the data is scoped in the database.

  return withRobotsHeader(response);
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html|cmd|ps1|gz|sh|txt)$).*)",
  ],
};
