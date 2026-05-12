import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";
import { getTierForUser } from "@/lib/auth-roles";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/login/")
  );
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Rate limit form submissions (POST only)
  if (pathname.startsWith("/forms") && request.method === "POST") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }
  }

  const supabase = createMiddlewareClient(request, response);

  // getUser() contacts Supabase Auth server — do NOT use getSession() here
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && pathname === "/login") {
    const dest = getTierForUser(user) === "partner" ? "/partner" : "/";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (user) {
    const tier = getTierForUser(user);

    if (tier === "partner") {
      const allowed =
        pathname.startsWith("/partner") || isPublicPath(pathname);
      if (!allowed) {
        return NextResponse.redirect(new URL("/partner", request.url));
      }
    } else if (pathname.startsWith("/partner")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Return response so refreshed session cookies are sent back to the browser
  return response;
}

export const config = {
  matcher: [
    // Root must be listed explicitly; the catch-all below can miss `/` on some Next.js versions.
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
