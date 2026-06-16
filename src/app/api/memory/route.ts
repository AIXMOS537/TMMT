import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logMemoryEvent, recallMemory } from "@/lib/memory";

/**
 * Memory Fabric — shared remember()/recall() HTTP entry point (Phase 2).
 *
 * This is the one door every agent (Claude Code, AIXMOS personas, dispatch
 * CAPTAIN, the brain-dump agent) and the optional MCP bridge call to share a
 * single brain. The interface is vendor-neutral: the body shape never changes
 * even if the recall backend is later swapped to pgvector (Phase 4) or an
 * external provider (Zep/Mem0).
 *
 * Auth: fail-closed bearer token. Set MEMORY_API_TOKEN in the environment.
 *   Authorization: Bearer <MEMORY_API_TOKEN>
 */

const actorKind = z.enum([
  "ai_agent",
  "operator",
  "team",
  "owner",
  "external",
  "system",
]);
const source = z.enum([
  "app",
  "slack",
  "clickup",
  "gmail",
  "quo",
  "calendar",
  "airtable",
  "agent",
  "system",
]);

const rememberSchema = z.object({
  op: z.literal("remember"),
  action: z.string().min(1).max(120),
  source: source.optional(),
  actorKind: actorKind.optional(),
  actorId: z.string().uuid().nullable().optional(),
  actorLabel: z.string().max(200).nullable().optional(),
  orgId: z.string().uuid().nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  dedupeKey: z.string().max(200).nullable().optional(),
  occurredAt: z.string().optional(),
});

const recallSchema = z.object({
  op: z.literal("recall"),
  query: z.string().max(500).optional(),
  entityId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  actorKind: actorKind.optional(),
  source: source.optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const bodySchema = z.discriminatedUnion("op", [rememberSchema, recallSchema]);

export async function POST(request: NextRequest) {
  const token = process.env.MEMORY_API_TOKEN;
  // Fail closed: no configured token, or a mismatch, rejects.
  const auth = request.headers.get("authorization");
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.op === "remember") {
    const { op: _op, ...input } = parsed.data;
    void _op;
    const ok = await logMemoryEvent(input);
    return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
  }

  // op === "recall"
  const { op: _op, ...input } = parsed.data;
  void _op;
  const result = await recallMemory(input);
  return NextResponse.json(result, { status: 200 });
}
