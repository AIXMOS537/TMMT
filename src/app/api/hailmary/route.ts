import { NextRequest, NextResponse } from "next/server";
import { recallMemory, logMemoryEvent } from "@/lib/memory";
import { generate } from "@/lib/ai/router";
import { HAILMARY_OPERATIVE_SYSTEM } from "@/lib/ai/persona";

/**
 * HAILMARY universal assistant endpoint — the one door every device talks to
 * (web console, Fire Stick / PS5 / TV browsers, phones, voice skills). Shares
 * the same brain + local-first AI router, so all devices stay in sync.
 *
 * Auth: Bearer MEMORY_API_TOKEN (same token as /api/memory).
 * Ops: ask (recall + operative answer) | recall | remember.
 */
export async function POST(req: NextRequest) {
  const token = process.env.MEMORY_API_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const op = typeof body.op === "string" ? body.op : "";
  const node = typeof body.node === "string" ? body.node : "web";

  if (op === "recall") {
    const r = await recallMemory({
      query: typeof body.query === "string" ? body.query : undefined,
      limit: typeof body.limit === "number" ? body.limit : 15,
    });
    return NextResponse.json(r);
  }

  if (op === "remember") {
    const text = String(body.text ?? "").slice(0, 2000);
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    const ok = await logMemoryEvent({
      action: "note",
      source: "agent",
      actorKind: "owner",
      actorLabel: `HAILMARY@${node}`,
      summary: text,
      details: { node },
    });
    return NextResponse.json({ ok });
  }

  if (op === "ask") {
    const q = String(body.query ?? "").slice(0, 1000);
    if (!q) return NextResponse.json({ error: "query required" }, { status: 400 });
    const ctx = await recallMemory({ query: q, limit: 15 });
    const prompt = `QUESTION/TASK: ${q}\n\nBRAIN CONTEXT (JSON):\n${JSON.stringify(ctx)}`;
    const res = await generate({
      system: HAILMARY_OPERATIVE_SYSTEM,
      prompt,
      maxTokens: 800,
    });
    if (res.backend !== "none") {
      await logMemoryEvent({
        action: "assistant_ask",
        source: "agent",
        actorKind: "owner",
        actorLabel: `HAILMARY@${node}`,
        summary: `Ask: ${q}`.slice(0, 200),
        details: { node, backend: res.backend },
      });
    }
    return NextResponse.json({ text: res.text, backend: res.backend, facts: ctx.facts });
  }

  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
