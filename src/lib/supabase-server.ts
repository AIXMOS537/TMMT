import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const _supabaseUrl: string = supabaseUrl;
const _supabaseAnonKey: string = supabaseAnonKey;

// For use in server actions, server components, and route handlers.
// cookies() returns a Promise in Next.js 15+, so createSSRClient must be async.
export async function createSSRClient() {
  const cookieStore = await cookies();
  return createServerClient(_supabaseUrl, _supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll is called during token refresh; in RSC render context this is a no-op
        }
      },
    },
  });
}

// For use in middleware — reads cookies from request, writes to response
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(_supabaseUrl, _supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
}
