import { NextResponse } from "next/server";
import { getDegradedComponents } from "@/lib/degraded";

/**
 * Public liveness probe — used by smoke-prod and dealer demo checklists.
 *
 * `degraded` lists components currently running on an in-process fallback
 * (F-18): empty when every durable path is answering. It is per instance —
 * the one that served this probe — and never changes `ok` or the status
 * code, so existing checks keep passing; a reader who wants to know whether
 * the rate limiter or GHL dedupe is really durable looks here.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "tmmt-ops",
    ts: new Date().toISOString(),
    degraded: getDegradedComponents(),
  });
}
