import { NextResponse } from "next/server";
import { getDegradedComponents } from "@/lib/degraded";
import { bearerMatches, secretMatches } from "@/lib/secure-compare";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/** How long the deep probe waits on the database before calling it down. */
const DB_PROBE_TIMEOUT_MS = 5_000;

/**
 * Public liveness probe — used by smoke-prod and dealer demo checklists.
 *
 * `degraded` lists components currently running on an in-process fallback
 * (F-18): empty when every durable path is answering. It is per instance —
 * the one that served this probe — and never changes `ok` or the status
 * code, so existing checks keep passing; a reader who wants to know whether
 * the rate limiter or GHL dedupe is really durable looks here.
 *
 * `?deep=1` (production finding F-03 / S-1): the plain probe never touches
 * the database, so it stayed green while server-side DB access was broken.
 * The deep probe makes one cheap round trip (a HEAD select, no rows) through
 * the service-role client and answers 503 when it fails. It is gated on
 * CRON_SECRET / OPS_COMMAND_SECRET (Bearer or x-cron-secret, same as the cron
 * routes) so the public cannot drive database load through it, and it never
 * returns the error text — that goes to the function log only.
 */
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep");
  if (deep === "1" || deep === "true") {
    if (!deepAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return deepProbe();
  }

  return NextResponse.json({
    ok: true,
    service: "tmmt-ops",
    ts: new Date().toISOString(),
    degraded: getDegradedComponents(),
  });
}

function deepAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  if (bearerMatches(req.headers.get("authorization"), secret)) return true;
  return secretMatches(req.headers.get("x-cron-secret"), secret);
}

async function deepProbe(): Promise<NextResponse> {
  const started = Date.now();
  let failure: string | null = null;
  try {
    const db = createServiceRoleClient();
    const { error } = await db
      .from("organizations")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(DB_PROBE_TIMEOUT_MS));
    if (error) failure = error.code ? `${error.code}: ${error.message}` : error.message;
  } catch (e) {
    failure = e instanceof Error ? e.message : "db probe threw";
  }
  const dbMs = Date.now() - started;

  if (failure) {
    console.error(`[health] deep probe failed ${JSON.stringify({ reason: failure, db_ms: dbMs })}`);
  }
  return NextResponse.json(
    {
      ok: !failure,
      service: "tmmt-ops",
      ts: new Date().toISOString(),
      db: failure ? "fail" : "ok",
      db_ms: dbMs,
      degraded: getDegradedComponents(),
    },
    { status: failure ? 503 : 200 }
  );
}
