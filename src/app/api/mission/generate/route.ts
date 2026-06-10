import { NextResponse } from "next/server";
import { sendOwnerMissionToTelegram, sendMissionToTeam } from "@/lib/mission/send";

export const dynamic = "force-dynamic";

type Audience = "owner" | "team";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  if (req.headers.get("x-mission-secret") === secret) return true;
  return false;
}

type Params = { notify: boolean; audience: Audience };

async function readParams(req: Request, defaultNotify: boolean): Promise<Params> {
  const { searchParams } = new URL(req.url);
  const fromQueryNotify = searchParams.get("notify");
  const fromQueryAudience = searchParams.get("audience");

  let notify = defaultNotify;
  let audience: Audience = "owner";

  if (fromQueryNotify !== null) notify = fromQueryNotify === "true" || fromQueryNotify === "1";
  if (fromQueryAudience === "team" || fromQueryAudience === "owner") audience = fromQueryAudience;

  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { notify?: boolean; audience?: string } | null;
      if (body && typeof body.notify === "boolean") notify = body.notify;
      if (body && (body.audience === "team" || body.audience === "owner")) audience = body.audience;
    } catch {
      // empty/invalid body — fall through to defaults
    }
  }

  return { notify, audience };
}

async function handle(req: Request, defaultNotify: boolean) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { notify, audience } = await readParams(req, defaultNotify);
    const greetingName = process.env.MISSION_GREETING_NAME ?? "Owner";

    if (audience === "team") {
      const result = await sendMissionToTeam({ notify, greetingName });
      return NextResponse.json({ ok: true, audience, ...result });
    }

    const result = await sendOwnerMissionToTelegram({ notify, greetingName });
    return NextResponse.json({ ok: true, audience, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "generate failed" },
      { status: 500 },
    );
  }
}

// GET is for crons (Vercel or external). Defaults notify=true.
export async function GET(req: Request) {
  return handle(req, true);
}

// POST is for manual smoke tests / external triggers.
// Defaults notify=false so a curl without an explicit flag is a safe dry-run.
export async function POST(req: Request) {
  return handle(req, false);
}
