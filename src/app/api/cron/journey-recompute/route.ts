import { NextResponse } from "next/server";
import { recomputeAllActiveJourneys, recomputeJourneyForEmail } from "@/lib/client-journey/recompute";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers.get("x-cron-secret");
  return header === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  try {
    if (email) {
      const result = await recomputeJourneyForEmail(email);
      return NextResponse.json({ ok: true, email, ...result });
    }

    const batch = await recomputeAllActiveJourneys();
    return NextResponse.json({ ok: true, ...batch });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "recompute failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
