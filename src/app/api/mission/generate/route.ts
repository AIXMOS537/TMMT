import { NextResponse } from "next/server";
import { sendOwnerMissionToTelegram } from "@/lib/mission/send";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  if (req.headers.get("x-mission-secret") === secret) return true;
  return false;
}

async function readNotifyFlag(req: Request, fallback: boolean): Promise<boolean> {
  const { searchParams } = new URL(req.url);
  const fromQuery = searchParams.get("notify");
  if (fromQuery !== null) return fromQuery === "true" || fromQuery === "1";
  if (req.method !== "POST") return fallback;
  try {
    const body = (await req.json()) as { notify?: boolean } | null;
    if (body && typeof body.notify === "boolean") return body.notify;
  } catch {
    // empty/invalid body — fall through
  }
  return fallback;
}

async function handle(req: Request, defaultNotify: boolean) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const notify = await readNotifyFlag(req, defaultNotify);
    const greetingName = process.env.MISSION_GREETING_NAME ?? "Owner";
    const result = await sendOwnerMissionToTelegram({ notify, greetingName });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "generate failed" },
      { status: 500 },
    );
  }
}

// GET is for Vercel cron (cron always issues GET). Defaults notify=true.
export async function GET(req: Request) {
  return handle(req, true);
}

// POST is for manual smoke tests / external triggers.
// Defaults notify=false so a curl without an explicit flag is a safe dry-run.
export async function POST(req: Request) {
  return handle(req, false);
}
