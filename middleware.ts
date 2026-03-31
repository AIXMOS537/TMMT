import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase-server";
import { isRateLimited } from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Rate limit form submissions (POST only)
  if (pathname.startsWith("/forms") && request.method === "POST") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

  const isPublic =
    pathname.startsWith("/login") || pathname.startsWith("/forms");

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Return response so refreshed session cookies are sent back to the browser
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
