import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Read + validate env lazily, so importing this module never throws at
// build-time module evaluation (e.g. Next.js "collect page data"). Missing
// env now fails when a client is actually created (request time), not on import.
function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { supabaseUrl, supabaseAnonKey };
}

// For use in server actions, server components, and route handlers.
// cookies() returns a Promise in Next.js 15+, so createSSRClient must be async.
export async function createSSRClient() {
  // Read cookies() BEFORE validating env. During Next.js static prerendering,
  // accessing cookies() triggers the dynamic-rendering bailout, so auth-gated
  // pages (which always need per-request cookies) render dynamically instead of
  // being prerendered at build time. This keeps the production build from
  // requiring Supabase env vars just to collect/prerender these pages; env is
  // still validated below on every real (runtime) request.
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
