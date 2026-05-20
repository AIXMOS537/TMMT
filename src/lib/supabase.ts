import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function requireSupabasePublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel."
    );
  }
  return { supabaseUrl, supabaseAnonKey };
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

function getBrowserClient() {
  if (!browserClient) {
    const { supabaseUrl, supabaseAnonKey } = requireSupabasePublicEnv();
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

// Browser / client-component client (SSR-aware, reads auth cookies)
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    const client = getBrowserClient();
    const value = client[prop as keyof typeof client];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Server-side client with service role for admin operations
export function createServiceClient() {
  const { supabaseUrl } = requireSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
