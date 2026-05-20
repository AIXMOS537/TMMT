import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getTierForUser, homePathForTier, type AccessTier } from "@/lib/auth-roles";
import { loadOrgLicenseForUser } from "@/lib/load-org-license";
import { staffPathBlocked } from "@/lib/org-license";
import {
  isOwnerHubHost,
  isPublicSiteHost,
  publicSiteOrigin,
} from "@/lib/site-domains";

function isAixmosStaticPath(pathname: string) {
  return (
    pathname.startsWith("/aixmos") ||
    pathname === "/apply" ||
    pathname === "/operator-apply" ||
    pathname === "/thankyou"
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/login/") ||
    isAixmosStaticPath(pathname)
  );
}

function pathAllowedForTier(pathname: string, tier: AccessTier): boolean {
  if (isPublicPath(pathname)) return true;

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
        pathname === "/" ||
        pathname.startsWith("/v/") ||
        pathname.startsWith("/teams") ||
        pathname.startsWith("/scripts") ||
        pathname.startsWith("/settings") ||
        (!pathname.startsWith("/vendor") &&
          !pathname.startsWith("/investor") &&
          !pathname.startsWith("/partner") &&
          !pathname.startsWith("/command") &&
          !pathname.startsWith("/executive") &&
          !pathname.startsWith("/operator"))
      );
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const ownerHub = isOwnerHubHost(host);
  const publicSite = isPublicSiteHost(host);

  // Public intake forms live on .com only — not the private .net owner hub.
  if (ownerHub && pathname.startsWith("/forms")) {
    return NextResponse.redirect(new URL(pathname, publicSiteOrigin()));
  }

  if (pathname.startsWith("/forms") && request.method === "POST") {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }
  }

  const supabase = createMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (publicSite && pathname === "/" && !ownerHub && !user) {
    return NextResponse.rewrite(new URL("/aixmos/index.html", request.url));
  }

  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && pathname === "/login") {
    const tier = getTierForUser(user);
    if (ownerHub) {
      if (tier === "owner") {
        return NextResponse.redirect(new URL("/command", request.url));
      }
      return NextResponse.redirect(new URL("/login?hub=owner", publicSiteOrigin()));
    }
    return NextResponse.redirect(new URL(homePathForTier(tier), request.url));
  }

  // .net is Muhammad's private access hub — admin (owner) only.
  if (ownerHub && user && getTierForUser(user) !== "owner") {
    return NextResponse.redirect(new URL("/login?hub=owner", publicSiteOrigin()));
  }

  if (ownerHub && user && pathname === "/") {
    return NextResponse.redirect(new URL("/command", request.url));
  }

  if (user && !pathAllowedForTier(pathname, getTierForUser(user))) {
    return NextResponse.redirect(new URL(homePathForTier(getTierForUser(user)), request.url));
  }

  if (pathname.startsWith("/partner")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/partner/, "/investor") || "/investor";
    return NextResponse.redirect(url);
  }

  if (user) {
    const tier = getTierForUser(user);
    if (tier === "investor") {
      const blocked =
        pathname.startsWith("/v/") ||
        pathname.startsWith("/teams") ||
        pathname.startsWith("/scripts") ||
        pathname.startsWith("/settings");
      if (blocked) {
        return NextResponse.redirect(new URL("/investor", request.url));
      }
    } else if (pathname.startsWith("/v/")) {
      const license = await loadOrgLicenseForUser(supabase, user.id);
      if (staffPathBlocked(pathname, license)) {
        return NextResponse.redirect(new URL("/?error=module", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|aixmos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html)$).*)",
  ],
};
