import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getTierForUser, homePathForTier, type AccessTier } from "@/lib/auth-roles";
import { isOwnerHubHost } from "@/lib/site-domains";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/robots.txt" ||
    pathname === "/kits" ||
    pathname === "/build" ||
    pathname.startsWith("/build/") ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/")
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
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

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

  const supabase = createMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html)$).*)",
  ],
};
