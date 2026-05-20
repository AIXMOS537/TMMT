import { NextResponse } from "next/server";
import { syncMarketingKpiWeekFromGhl } from "@/lib/marketing-kpi/ghl-sync";
import { weekStartMonday } from "@/lib/marketing-kpi/queries";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("week_start") ?? weekStartMonday();

  try {
    const { row, auto } = await syncMarketingKpiWeekFromGhl(weekStart);
    return NextResponse.json({ ok: true, week_start: weekStart, auto, row });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
