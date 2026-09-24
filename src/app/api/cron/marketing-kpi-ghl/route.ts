import { NextResponse } from "next/server";
import { syncMarketingKpiWeekFromGhl } from "@/lib/marketing-kpi/ghl-sync";
import { weekStartMonday } from "@/lib/marketing-kpi/queries";
import { bearerMatches, secretMatches } from "@/lib/secure-compare";
import { clearDegraded, reportDegraded } from "@/lib/degraded";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  if (bearerMatches(req.headers.get("authorization"), secret)) return true;
  return secretMatches(req.headers.get("x-cron-secret"), secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("week_start") ?? weekStartMonday();

  // Finding F-11 / S-6: this job ran weekly and left one row in four months
  // without anyone hearing about it. Every failure now (1) answers non-2xx, so
  // the Vercel cron run shows as failed, and (2) goes through reportDegraded:
  // a structured `[degraded]` console.error line, a Sentry warning when a DSN
  // is set, and an entry on this instance's /api/health.
  try {
    const { row, auto } = await syncMarketingKpiWeekFromGhl(weekStart);

    // The M1 GHL mirror stamps synced_at on every contact each run (every 6h).
    // Zero contacts touched in the week means the mirror is down, so the
    // numbers just written are not a quiet week, they are missing data.
    if ((auto.details.contacts_synced ?? 0) === 0) {
      reportDegraded("marketing-kpi-ghl", "no ghl_contacts synced in week; GHL mirror looks stale", {
        week_start: weekStart,
      });
      return NextResponse.json(
        { ok: false, error: "ghl_mirror_stale", week_start: weekStart, auto, row },
        { status: 503 }
      );
    }

    clearDegraded("marketing-kpi-ghl");
    return NextResponse.json({ ok: true, week_start: weekStart, auto, row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync failed";
    reportDegraded("marketing-kpi-ghl", message, { week_start: weekStart });
    return NextResponse.json({ ok: false, error: "sync failed", week_start: weekStart }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
