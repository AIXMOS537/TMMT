import { NextResponse } from "next/server";
import { recallRich } from "@/lib/memory";
import { generate } from "@/lib/ai/router";
import { HAILMARY_OPERATIVE_SYSTEM } from "@/lib/ai/persona";
import { escalateToOwner } from "@/lib/escalate";

export const dynamic = "force-dynamic";

/**
 * Auto morning brief — builds the owner's operative situation report from the
 * brain (local-first AI) and sends it to the WORK CELL via escalateToOwner
 * (working-hours aware; never the personal line). Schedule it ~8am ET in
 * vercel.json crons, or hit it from a local scheduler on Brainiac.
 *
 * Auth: CRON_SECRET (Bearer or x-cron-secret).
 */
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

  const ctx = await recallRich(
    "today priorities open support cases assignments escalations pipeline",
    { limit: 20 }
  );
  const prompt =
    "Build the owner's MORNING operative brief: the top 3-5 priorities right now " +
    "and the single next move for each, based ONLY on this context. Be terse.\n\n" +
    `CONTEXT (JSON):\n${JSON.stringify(ctx)}`;

  const res = await generate({ system: HAILMARY_OPERATIVE_SYSTEM, prompt, maxTokens: 700 });
  const text = res.text?.trim() || "No model reachable for the brief.";
  const esc = await escalateToOwner(`HAILMARY morning brief:\n${text}`);

  return NextResponse.json({
    ok: true,
    backend: res.backend,
    delivered: esc.delivered,
    queued: esc.queued ?? false,
  });
}
