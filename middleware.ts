import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getTierForUser, homePathForTier, type AccessTier } from "@/lib/auth-roles";
import {
  isOwnerHubHost,
  publicSiteOrigin,
} from "@/lib/site-domains";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/login/")
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
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const ownerHub = isOwnerHubHost(host);

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

  return response;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
