import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export type SessionContext = {
  response: NextResponse;
  user: { id: string; email?: string } | null;
  role: string | null;
  portal_role: string | null;
};

/**
 * Refreshes the Supabase session cookie on every request and returns the
 * (possibly-mutated) response plus the resolved user. Called from middleware.ts.
 */
export async function updateSession(request: NextRequest): Promise<SessionContext> {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  let portal_role: string | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, portal_role")
      .eq("id", user.id)
      .maybeSingle();
    role = (data?.role as string | undefined) ?? null;
    portal_role = (data?.portal_role as string | undefined) ?? null;
  }

  return { response, user, role, portal_role };
}
