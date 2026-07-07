/**
 * POST /api/agent/voice/ghl
 * GHL Voice AI Custom Action webhook — mid-call automation.
 *
 * Configure in GHL: AI Agents → Voice AI → Agent Goals → Advanced → Custom Actions
 * Method: POST
 * Header: x-ghl-voice-secret = GHL_VOICE_WEBHOOK_SECRET
 *
 * Body JSON:
 * {
 *   "action": "qualify_lead" | "book_handoff" | "escalate_human" | "tag_vertical" | "post_call_summary",
 *   "phone": "{{contact.phone}}",
 *   "contact_id": "{{contact.id}}",
 *   "vertical": "rentals" | "detailing" | "credit" | "moving",
 *   "transcript_snippet": "{{last_user_message}}",
 *   "caller_name": "{{contact.first_name}}",
 *   "appointment_time": "Saturday 2:30pm",
 *   "org_slug": "tmmt-rentals"
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  handleGhlVoiceAction,
  type GhlVoicePayload,
  type VoiceAction,
} from "@/lib/agent/voice/ghl-voice-handler";

const ACTIONS: VoiceAction[] = [
  "qualify_lead",
  "book_handoff",
  "escalate_human",
  "tag_vertical",
  "post_call_summary",
];

function authOk(req: NextRequest): boolean {
  const secret = process.env.GHL_VOICE_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("x-ghl-voice-secret") === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // GHL Custom Actions may send fields at top level or nested under customData
  const merged =
    body.customData && typeof body.customData === "object"
      ? { ...(body.customData as Record<string, unknown>), ...body }
      : body;

  const action = String(merged.action ?? body.action ?? "") as VoiceAction;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "Invalid action", allowed: ACTIONS },
      { status: 400 }
    );
  }

  const payload: GhlVoicePayload = {
    action,
    phone: typeof merged.phone === "string" ? merged.phone : typeof body.phone === "string" ? body.phone : undefined,
    contact_id:
      typeof merged.contact_id === "string"
        ? merged.contact_id
        : typeof body.contact_id === "string"
          ? body.contact_id
          : undefined,
    vertical: typeof merged.vertical === "string" ? merged.vertical : typeof body.vertical === "string" ? body.vertical : undefined,
    transcript_snippet:
      typeof merged.transcript_snippet === "string"
        ? merged.transcript_snippet
        : typeof body.transcript_snippet === "string"
          ? body.transcript_snippet
          : undefined,
    caller_name:
      typeof merged.caller_name === "string"
        ? merged.caller_name
        : typeof body.caller_name === "string"
          ? body.caller_name
          : undefined,
    appointment_time:
      typeof merged.appointment_time === "string"
        ? merged.appointment_time
        : typeof body.appointment_time === "string"
          ? body.appointment_time
          : undefined,
    org_slug:
      typeof merged.org_slug === "string"
        ? merged.org_slug
        : typeof body.org_slug === "string"
          ? body.org_slug
          : undefined,
    location_kind:
      merged.location_kind === "restoration" || body.location_kind === "restoration"
        ? "restoration"
        : "rentals",
  };

  try {
    const result = await handleGhlVoiceAction(payload);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    console.error("[agent/voice/ghl]", e);
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://tmmt-ops.vercel.app";
  return NextResponse.json({
    service: "tmmt-voice-ai-ghl",
    status: process.env.GHL_VOICE_WEBHOOK_SECRET ? "ready" : "missing_secret",
    webhook_url: `${base}/api/agent/voice/ghl`,
    actions: ACTIONS,
    agent: "Bella",
  });
}
