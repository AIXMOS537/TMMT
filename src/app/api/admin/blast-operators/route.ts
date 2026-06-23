/**
 * POST /api/admin/blast-operators
 * Sends a magic-link login email to every user whose app_metadata.role === 'operator'.
 * Protected by CRON_SECRET (same key used by mission/generate).
 *
 * Usage:
 *   curl -X POST https://tmmt-command-center.vercel.app/api/admin/blast-operators \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 *
 * Returns JSON: { sent: string[], errors: {email:string, error:string}[] }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase service role key not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // List all auth users (Supabase admin API returns up to 1000 per page)
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const operators = (users ?? []).filter(
    (u) => u.app_metadata?.role === "operator"
  );

  if (operators.length === 0) {
    return NextResponse.json({ message: "No operator accounts found", sent: [], errors: [] });
  }

  const sent: string[] = [];
  const errors: { email: string; error: string }[] = [];
  const portalUrl = "https://tmmt-command-center.vercel.app/operator/training";

  for (const op of operators) {
    if (!op.email) continue;
    const { error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: op.email,
      options: {
        redirectTo: portalUrl,
      },
    });

    if (error) {
      errors.push({ email: op.email, error: error.message });
    } else {
      sent.push(op.email);
    }
  }

  return NextResponse.json({
    message: `Blasted ${sent.length}/${operators.length} operator(s)`,
    sent,
    errors,
    portalUrl,
  });
}
