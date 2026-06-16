import { NextResponse } from "next/server";
import { logMemoryEvent } from "@/lib/memory";
import { CLICKUP_TEAM_ID } from "@/lib/clickup/config";

export const dynamic = "force-dynamic";

/**
 * ClickUp → brain ingestor. Pulls recently-updated tasks and logs them as
 * memory_events (source=clickup) so recon/ask/the morning brief see live ops.
 * Idempotent via dedupe_key. Env-gated on CLICKUP_API_TOKEN; fail-open.
 *
 * Auth: CRON_SECRET (Bearer or x-cron-secret). Schedule in vercel.json or a
 * local Brainiac cron.
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
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) return NextResponse.json({ ok: true, skipped: "no CLICKUP_API_TOKEN" });

  const url = `https://api.clickup.com/api/v2/team/${CLICKUP_TEAM_ID}/task?order_by=updated&include_closed=false&subtasks=true`;
  let tasks: Array<Record<string, unknown>> = [];
  try {
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `clickup ${res.status}` }, { status: 200 });
    }
    const j = (await res.json()) as { tasks?: Array<Record<string, unknown>> };
    tasks = Array.isArray(j.tasks) ? j.tasks : [];
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 200 });
  }

  let ingested = 0;
  for (const t of tasks.slice(0, 50)) {
    const id = String(t.id ?? "");
    if (!id) continue;
    const status = (t.status as { status?: string } | undefined)?.status ?? "task";
    const updated = t.date_updated ? Number(t.date_updated) : Date.now();
    const assignee =
      (t.assignees as Array<{ username?: string }> | undefined)?.[0]?.username ?? "clickup";
    const ok = await logMemoryEvent({
      action: "clickup_task",
      source: "clickup",
      actorKind: "team",
      actorLabel: assignee,
      summary: `[${status}] ${String(t.name ?? "task")}`.slice(0, 200),
      details: { id, status, url: t.url ?? null },
      dedupeKey: `clickup:task:${id}:${updated}`,
      occurredAt: new Date(updated).toISOString(),
    });
    if (ok) ingested += 1;
  }
  return NextResponse.json({ ok: true, scanned: tasks.length, ingested });
}
