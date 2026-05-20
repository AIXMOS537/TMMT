import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  let next = url.searchParams.get("next") ?? "/portals";

  if (authError) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", "auth");
    login.searchParams.set("message", authError);
    return NextResponse.redirect(login);
  }

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const login = new URL("/login", url.origin);
      login.searchParams.set("error", "auth");
      login.searchParams.set("message", error.message);
      return NextResponse.redirect(login);
    }
  }

  if (next === "/" || next === "/login") {
    next = "/portals";
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
