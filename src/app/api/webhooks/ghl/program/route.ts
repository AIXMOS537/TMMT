import { NextRequest, NextResponse } from "next/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase-service";
import { createProgramApplicationFromGhl } from "@/lib/program-applications-server";
import { consumeGhlEventId, deriveGhlEventId, verifyGhlWebhook } from "@/lib/ghl/webhook-auth";

const INTERNAL_CONSUMED_HEADER = "x-tmmt-ghl-consumed";

const PROGRAM_TAGS = new Set([
  "ready-for-aixmos",
  "aixmos-program",
  "credit-guidance",
  "aixmos",
]);

/**
 * GHL workflow → create program_applications row + Learn face deep link.
 *
 * POST JSON: { email, contact_id?, first_name?, last_name?, tags?, event? }
 * Header: x-ghl-webhook-secret = GHL_WEBHOOK_SECRET
 *
 * Triggers when tags include ready-for-aixmos (or event=aixmos.program.start).
 */
export async function POST(request: NextRequest) {
  // Fail closed: a missing secret must reject, never allow all.
  const rawBody = await request.text();
  const auth = verifyGhlWebhook(request, rawBody);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 400 ? "Stale webhook" : "Unauthorized" },
      { status: auth.status }
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hopId = request.headers.get(INTERNAL_CONSUMED_HEADER);
  if (hopId !== deriveGhlEventId(body)) {
    const idemSupabase = tryCreateServiceRoleClient() ?? undefined;
    const idem = await consumeGhlEventId(body, idemSupabase);
    if (!idem.ok) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 409 });
    }
  }

  const email =
    (typeof body.email === "string" && body.email) ||
    (typeof body.contact_email === "string" && body.contact_email) ||
    "";

  if (!email) {
    return NextResponse.json({ ok: true, skipped: "no email" });
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).toLowerCase())
    : typeof body.tag === "string"
      ? [String(body.tag).toLowerCase()]
      : [];

  const event = typeof body.event === "string" ? body.event : "";
  const shouldStart =
    event === "aixmos.program.start" ||
    tags.some((t) => PROGRAM_TAGS.has(t) || t.includes("ready-for-aixmos"));

  if (!shouldStart) {
    return NextResponse.json({ ok: true, skipped: "no program trigger" });
  }

  const first = typeof body.first_name === "string" ? body.first_name : "";
  const last = typeof body.last_name === "string" ? body.last_name : "";
  const clientName = [first, last].filter(Boolean).join(" ") || undefined;
  const ghlContactId =
    (typeof body.contact_id === "string" && body.contact_id) ||
    (typeof body.id === "string" && body.id) ||
    undefined;

  try {
    const result = await createProgramApplicationFromGhl({
      email,
      clientName,
      ghlContactId,
      tags,
    });

    return NextResponse.json({
      ok: true,
      applicationId: result.id,
      learnUrl: result.learnUrl,
      message: "Send learnUrl to contact (SMS/email) for onboarding",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "create failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
