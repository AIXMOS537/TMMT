import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { PORTAL_PATH_ACCESS } from "@/lib/access/portals";

function canAccessPath(
  pathname: string,
  role: string | null,
  portal_role: string | null
): boolean {
  for (const [prefix, rules] of Object.entries(PORTAL_PATH_ACCESS)) {
    if (!pathname.startsWith(prefix)) continue;

    if (portal_role && (rules.portalRoles as readonly string[]).includes(portal_role)) {
      return true;
    }
    if (role && rules.legacyRoles && (rules.legacyRoles as readonly string[]).includes(role)) {
      return true;
    }
    return false;
  }
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/intake") ||
    pathname === "/api/status" ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/agents/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const { response, user, role, portal_role } = await updateSession(request);

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/intake") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/marketplace") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth");
  if (isPublic) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(pathname, role, portal_role)) {
    return NextResponse.redirect(new URL("/portals?error=forbidden", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
