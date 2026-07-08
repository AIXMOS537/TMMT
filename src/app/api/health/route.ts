import { NextResponse } from "next/server";

/** Public liveness probe — used by smoke-prod and dealer demo checklists. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "tmmt-ops",
    ts: new Date().toISOString(),
  });
}
