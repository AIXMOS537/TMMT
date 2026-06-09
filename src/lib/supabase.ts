import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

// Server-side client with service role for admin operations
export function createServiceClient() {
  const { supabaseUrl } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
