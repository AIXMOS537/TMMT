import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AGENT_NAMES, AGENT_VOTES } from "@/lib/agents/types";
import { castAgentVote, getEvaluationSession, openEvaluationSession } from "@/lib/agents/evaluate";

const OpenBody = z.object({
  action: z.literal("open"),
  subject_type: z.string().min(1),
  subject_id: z.string().uuid(),
  required_approvals: z.number().int().min(1).max(5).optional(),
  panel_size: z.number().int().min(1).max(5).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const VoteBody = z.object({
  action: z.literal("vote"),
  session_id: z.string().uuid(),
  agent: z.enum(AGENT_NAMES),
  vote: z.enum(AGENT_VOTES),
  rationale: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

const GetBody = z.object({
  action: z.literal("get"),
  session_id: z.string().uuid(),
});

const Body = z.discriminatedUnion("action", [OpenBody, VoteBody, GetBody]);

/**
 * AI agent evaluation API — 3-of-5 approval panel.
 * Used by n8n flows or internal automations. Protect with AGENT_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.action === "open") {
      const session = await openEvaluationSession(
        {
          subjectType: parsed.data.subject_type,
          subjectId: parsed.data.subject_id,
          metadata: parsed.data.metadata,
        },
        {
          requiredApprovals: parsed.data.required_approvals,
          panelSize: parsed.data.panel_size,
        }
      );
      return NextResponse.json({ ok: true, session });
    }

    if (parsed.data.action === "vote") {
      const result = await castAgentVote({
        sessionId: parsed.data.session_id,
        agent: parsed.data.agent,
        vote: parsed.data.vote,
        rationale: parsed.data.rationale,
        payload: parsed.data.payload,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const detail = await getEvaluationSession(parsed.data.session_id);
    return NextResponse.json({ ok: true, ...detail });
  } catch (e) {
    const message = e instanceof Error ? e.message : "evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
