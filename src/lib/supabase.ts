import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const _supabaseUrl: string = supabaseUrl;
const _supabaseAnonKey: string = supabaseAnonKey;

// Browser / client-component client (SSR-aware, reads auth cookies)
export const supabase = createBrowserClient(_supabaseUrl, _supabaseAnonKey);

// Server-side client with service role for admin operations
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(_supabaseUrl, serviceRoleKey);
}
