import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { executeOpsCommands } from "@/lib/ops-command/execute";
import { OpsCommandSchema } from "@/lib/ops-command/types";

/**
 * Remote ops command intake — the bridge that lets `TMMT ops <natural language>`
 * commands from any device reach the ops engine.
 *
 * Drivers: tmmt-agent-channel/command_router.py (Telegram / iMessage / Slack / CLI).
 * Contract (must stay in sync with command_router.py → run_ops):
 *   POST /api/ops/command
 *   Authorization: Bearer <OPS_COMMAND_SECRET>
 *   body: { "message": "<natural language>" }  // or { "commands": [...] }
 *   200:  OpsCommandResponse { ok, parsed_from_message?, results: [...] }
 *
 * Fail-closed: a missing secret rejects everything; the bearer is compared in
 * constant time. This endpoint runs verified ops actions (assign, advance case,
 * approve CRM sync, post ledger) with the service role, so access is gated to
 * holders of OPS_COMMAND_SECRET only. Widen access later via the router's
 * per-operator allow-list, never by loosening this gate.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerMatches(header: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length).trim());
  const expected = Buffer.from(secret);
  // timingSafeEqual throws on length mismatch; guard first to avoid leaking length via exception timing.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

const BodySchema = z
  .object({
    message: z.string().min(1).max(2000).optional(),
    commands: z.array(OpsCommandSchema).optional(),
    actor: z
      .object({
        id: z.string().min(1),
        email: z.string().email().nullish(),
      })
      .optional(),
  })
  .refine((b) => Boolean(b.message?.trim()) || (b.commands?.length ?? 0) > 0, {
    message: "Provide a non-empty `message` or at least one `command`.",
  });

export async function POST(request: NextRequest) {
  const secret = process.env.OPS_COMMAND_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "OPS_COMMAND_SECRET not configured" },
      { status: 503 }
    );
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const actor = parsed.data.actor ?? { id: "ops_command", email: "ops_command@tmmt" };

  const response = await executeOpsCommands({
    supabase,
    message: parsed.data.message,
    commands: parsed.data.commands,
    actor,
  });

  return NextResponse.json(response, { status: 200 });
}
