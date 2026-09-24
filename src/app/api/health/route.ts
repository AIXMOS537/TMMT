import { NextResponse } from "next/server";
import { getDegradedComponents } from "@/lib/degraded";
import { bearerMatches, secretMatches } from "@/lib/secure-compare";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { checkIntegrationFreshness, problemsOnly } from "@/lib/integration-freshness";

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
 *
 * `?integrations=1` answers a different question that nothing else asked: has
 * an inbound rail gone QUIET? The GHL webhook rail has received zero events
 * since it was built and crm_sync_records stopped in June — neither was
 * noticed for months, because every other check asks "did a call fail?" and
 * none asks "has anything arrived lately?". It distinguishes `never` (nobody
 * wired it up — a console task, not a bug) from `stale` (it worked and
 * stopped). It reads the database, so it sits behind the same secret as the
 * deep probe: the plain probe must never touch the database, and the public
 * must not be able to drive database load through this route. Like
 * `degraded`, it never changes `ok` or the status code — a quiet integration
 * is not a dead service — and a failure to read it is reported, not hidden.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const deep = params.get("deep");
  const integrations = params.get("integrations");
  const wantsDeep = deep === "1" || deep === "true";
  const wantsIntegrations = integrations === "1" || integrations === "true";

  if ((wantsDeep || wantsIntegrations) && !deepAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (wantsDeep) return deepProbe();
  if (wantsIntegrations) return integrationsProbe();

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

async function integrationsProbe(): Promise<NextResponse> {
  let integrations: unknown[] = [];
  let integrationsError: string | null = null;
  try {
    integrations = problemsOnly(await checkIntegrationFreshness(createServiceRoleClient()));
  } catch (e) {
    // Never let the freshness probe take down the liveness probe.
    integrationsError = e instanceof Error ? e.message : "integration freshness check failed";
  }

  return NextResponse.json({
    ok: true,
    service: "tmmt-ops",
    ts: new Date().toISOString(),
    degraded: getDegradedComponents(),
    integrations,
    ...(integrationsError ? { integrationsError } : {}),
  });
}
