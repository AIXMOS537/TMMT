import { NextResponse } from "next/server";
import { getDegradedComponents } from "@/lib/degraded";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { checkIntegrationFreshness, problemsOnly } from "@/lib/integration-freshness";

/**
 * Public liveness probe — used by smoke-prod and dealer demo checklists.
 *
 * `degraded` lists components currently running on an in-process fallback
 * (F-18): empty when every durable path is answering. It is per instance —
 * the one that served this probe — and never changes `ok` or the status
 * code, so existing checks keep passing; a reader who wants to know whether
 * the rate limiter or GHL dedupe is really durable looks here.
 *
 * `integrations` answers a different question that nothing else asked: has an inbound rail
 * gone QUIET? The GHL webhook rail has received zero events since it was built and
 * crm_sync_records stopped in June — neither was noticed for months, because every other
 * check asks "did a call fail?" and none asks "has anything arrived lately?".
 *
 * It distinguishes `never` (nobody wired it up — a console task, not a bug) from `stale`
 * (it worked and stopped). Sending someone to debug working code is its own kind of waste.
 *
 * Like `degraded`, it never changes `ok` or the status code: this endpoint is a liveness
 * probe that smoke tests and dealer checklists depend on, and a quiet integration is not a
 * dead service. A failure to read it is reported rather than hidden.
 */
export async function GET() {
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
