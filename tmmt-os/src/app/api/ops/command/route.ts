import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OpsCommandSchema, type OpsCommand } from "@/lib/ops-command/types";
import { executeOpsCommands } from "@/lib/ops-command/execute";

const Body = z.object({
  message: z.string().optional(),
  commands: z.array(OpsCommandSchema).optional(),
});

async function resolveActor(req: NextRequest) {
  const secret = process.env.OPS_COMMAND_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (secret && bearer && bearer === secret) {
    return { mode: "service" as const, actor: { id: "ops-command", email: "ops-command@system" } };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal_team"].includes(profile.role as string)) {
    return null;
  }

  return {
    mode: "session" as const,
    actor: { id: profile.id, email: profile.email },
  };
}

/**
 * Unified ops command API — use from Cursor chat, automations, or /internal/assistant.
 *
 * POST { "message": "assign maria@tmmt.com to case TMMT-ABC123" }
 * or   { "commands": [{ "action": "summary" }] }
 *
 * Auth: staff session cookie OR Authorization: Bearer $OPS_COMMAND_SECRET
 */
export async function POST(req: NextRequest) {
  const auth = await resolveActor(req);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const response = await executeOpsCommands({
    supabase,
    message: parsed.data.message,
    commands: parsed.data.commands as OpsCommand[] | undefined,
    actor: auth.actor,
  });

  return NextResponse.json(response);
}

export async function GET(req: NextRequest) {
  const auth = await resolveActor(req);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const response = await executeOpsCommands({
    supabase,
    commands: [{ action: "summary" }],
    actor: auth.actor,
  });

  return NextResponse.json(response);
}
