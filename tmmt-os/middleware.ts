import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { clientPathBlockedByOrgCap, staffPathBlockedByOrgLicense } from "@/lib/access/org-license";
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
    pathname === "/api/webhooks/stripe" ||
    pathname.startsWith("/api/agents/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const { response, user, role, portal_role, org_entitlement_cap, org_license } =
    await updateSession(request);

  const isPublic =
    pathname === "/" ||
    pathname === "/track" ||
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

  const blockedSlug = clientPathBlockedByOrgCap(pathname, org_entitlement_cap);
  if (blockedSlug) {
    const dest = pathname.startsWith("/client")
      ? "/client/dashboard?error=module"
      : "/portals?error=module";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  const blockedModule = staffPathBlockedByOrgLicense(pathname, org_license);
  if (blockedModule) {
    const dest = pathname.startsWith("/v/")
      ? "/internal/dashboard?error=module"
      : pathname.startsWith("/internal")
        ? "/internal/dashboard?error=module"
        : "/portals?error=module";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
