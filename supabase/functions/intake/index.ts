// supabase/functions/intake/index.ts
//
// Public anon-write gate. Validates Cloudflare Turnstile (when configured)
// and forwards the insert to an allow-listed table using the project's
// service role key.
//
// Activation plan:
//   1. Owner sets TURNSTILE_SECRET_KEY in Supabase Edge Function secrets.
//   2. Front-end forms swap their direct anon insert for:
//        POST /functions/v1/intake
//        body: { table: "incoming_leads", payload: { ... }, turnstile_token: "..." }
//   3. After verification in staging, run the revoke block in INFRA_HARDENING.md §3
//      to take anon INSERT off the listed tables. Until step 3 the function is
//      dormant and the existing anon-insert path keeps working.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_TABLES = new Set<string>([
  "incoming_leads",
  "waitlist",
  "appointments",
  "background_checks",
  "customer_intake_forms",
  "tickets",
  "vehicle_handover",
  "customer_inspection_photos",
  "vehicle_onboarding_inspections",
]);

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-turnstile-token, apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, code: "method_not_allowed" }, 405);
  }

  let body: {
    table?: string;
    payload?: Record<string, unknown>;
    turnstile_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }

  const table = String(body.table ?? "");
  if (!table || !ALLOWED_TABLES.has(table)) {
    return json({ ok: false, code: "table_not_allowed" }, 400);
  }
  if (
    !body.payload ||
    typeof body.payload !== "object" ||
    Array.isArray(body.payload)
  ) {
    return json({ ok: false, code: "missing_payload" }, 400);
  }

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (turnstileSecret) {
    const token =
      body.turnstile_token ?? req.headers.get("x-turnstile-token") ?? "";
    if (!token) return json({ ok: false, code: "turnstile_missing" }, 400);

    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";

    const form = new FormData();
    form.append("secret", turnstileSecret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);

    let verifyOk = false;
    try {
      const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        body: form,
      });
      const verify = (await verifyRes.json()) as {
        success: boolean;
        "error-codes"?: string[];
      };
      verifyOk = Boolean(verify.success);
      if (!verifyOk) {
        return json(
          {
            ok: false,
            code: "turnstile_failed",
            errors: verify["error-codes"] ?? [],
          },
          403
        );
      }
    } catch (e) {
      return json(
        {
          ok: false,
          code: "turnstile_unreachable",
          message: e instanceof Error ? e.message : String(e),
        },
        503
      );
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, code: "server_not_configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from(table)
    .insert(body.payload)
    .select("id")
    .single();

  if (error) {
    return json(
      { ok: false, code: "insert_failed", message: error.message },
      500
    );
  }

  return json({ ok: true, id: (data as { id?: string })?.id ?? null });
});
