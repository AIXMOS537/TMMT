import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

// Read + validate env lazily, so importing this module never throws at
// build-time module evaluation (e.g. Next.js "collect page data"). Missing
// env now fails at actual use/runtime rather than crashing the build.
function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { supabaseUrl, supabaseAnonKey };
}

// Browser / client-component client (SSR-aware, reads auth cookies).
// Created once on first use and reused (singleton).
let _browserClient: SupabaseClient | null = null;
function getBrowserClient(): SupabaseClient {
  if (!_browserClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    _browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _browserClient;
}

// Lazy proxy: importing `supabase` never instantiates the client or reads env.
// The real client (and env validation) is resolved on first property access.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getBrowserClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

// createServiceClient() used to live here. It had zero call sites, and this
// module is the browser client — imported by ~38 "use client" pages through
// @/lib/queries. A service-role factory sitting in that module is one careless
// import away from being a real problem, and nothing was gaining from it.
//
// Use @/lib/supabase-service instead: createServiceRoleClient() is the same
// thing with `import "server-only"` at the top, which is the guard that
// actually stops a service key being pulled into a client bundle.
