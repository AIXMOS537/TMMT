import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordGhlPayment, shouldRecordPayment } from "@/lib/ghl-payment-sync";
import { grantMonthlyTokensForPayment, type TopupOutcome } from "@/lib/token-ledger";
import { recordCollectedReferral } from "@/lib/referrals";
import { extractPaymentRef } from "@/lib/ghl-payment-sync";
import { isClickUpEnabled } from "@/lib/clickup/client";
import { syncGhlEventToClickUp } from "@/lib/clickup/sync-case";
import { dispatchGhlWebhook } from "@/lib/ghl/dispatch";
import {
  isAppointmentPayload,
  isContactPayload,
  isFormPayload,
  isOpportunityStagePayload,
} from "@/lib/ghl/payload";

/**
 * GoHighLevel webhook entry point (merged).
 *
 * Two payload families share this endpoint:
 *
 * 1. CRM sync events (opportunity.stage_changed, contact.created/updated,
 *    form.submitted, appointment.booked) → routed to the payload dispatcher
 *    (`dispatchGhlWebhook`) which writes to crm_sync_records / ghl_contacts /
 *    ghl_form_submissions / ghl_appointments + Airtable + auto-ops.
 *
 * 2. Tag / program payloads ({ email, tags?, event?, contact_id? }) → the
 *    pre-existing affiliate/program behavior: program-application creation,
 *    payment recording, ClickUp task sync, and service_notes / lead-notes
 *    stamping. This logic is preserved verbatim below.
 *
 * Header: x-ghl-webhook-secret must match GHL_WEBHOOK_SECRET (existing GHL
 * workflows). The dispatch sub-handlers additionally honor x-ghl-secret via
 * their dedicated routes; this merged route gates on x-ghl-webhook-secret to
 * keep existing workflows working.
 */
export async function POST(request: NextRequest) {
  // Fail closed: a missing secret must reject, never allow all.
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-ghl-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- CRM sync events take priority: route recognized payloads to dispatch ---
  const isCrmPayload =
    isOpportunityStagePayload(body) ||
    isContactPayload(body) ||
    isFormPayload(body) ||
    isAppointmentPayload(body);

  if (isCrmPayload) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    const supabase = createClient(url, serviceKey);
    const result = await dispatchGhlWebhook(supabase, body);
    return NextResponse.json(result.body, { status: result.status });
  }

  // --- Existing affiliate / program / payment / ClickUp tag behavior ---
  const email =
    (typeof body.email === "string" && body.email) ||
    (typeof body.contact_email === "string" && body.contact_email) ||
    "";
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).toLowerCase())
    : typeof body.tag === "string"
      ? [String(body.tag).toLowerCase()]
      : [];
  const event = typeof body.event === "string" ? body.event : "ghl_webhook";

  if (!email) {
    return NextResponse.json({ ok: true, skipped: "no email" });
  }

  const programTrigger =
    event === "aixmos.program.start" ||
    tags.some((t) => t.includes("ready-for-aixmos") || t === "aixmos-program");

  if (programTrigger) {
    const origin = request.nextUrl.origin;
    const programRes = await fetch(`${origin}/api/webhooks/ghl/program`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-ghl-webhook-secret": secret } : {}),
      },
      body: JSON.stringify(body),
    });
    const programJson = await programRes.json();
    if (programRes.ok && programJson.learnUrl) {
      return NextResponse.json({ ok: true, program: programJson });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey);
  const stamp = new Date().toISOString();

  let paymentResult:
    | { recorded: boolean; id?: string; reason?: string; amount?: number; affiliateRef?: string | null }
    | undefined;
  if (shouldRecordPayment(body, tags)) {
    paymentResult = await recordGhlPayment(supabase, body, tags);
  }

  // TMMT token top-up: a member-97 (or other granting) payment grants the org's
  // monthly token stack — the "$97/mo buys TMMT tokens" half of the genie meter.
  // Idempotent (dedupe on the payment ref) and a no-op for non-granting tags or
  // members not yet tied to an org. Never blocks the webhook on failure.
  let tokenTopup: TopupOutcome | undefined;
  try {
    tokenTopup = await grantMonthlyTokensForPayment(supabase, {
      email,
      tags,
      paymentRef: paymentResult?.id ?? null,
    });
  } catch (e) {
    console.error("[ghl tmmt-topup]", e instanceof Error ? e.message : e);
  }
  const tokenLine =
    tokenTopup?.topped_up ? { tokens: tokenTopup } : {};

  // Referral earnings: a COLLECTED sale that carries a referral code pays the
  // referrer a single-tier commission. Idempotent on the payment ref; a no-op
  // when there's no code, no amount, or an unknown code. Collected sales only —
  // no guaranteed/passive income (protective structure for the owner).
  let referralPaid: { commission: number } | undefined;
  if (paymentResult?.recorded && paymentResult.affiliateRef && (paymentResult.amount ?? 0) > 0) {
    try {
      const r = await recordCollectedReferral(supabase, {
        code: paymentResult.affiliateRef,
        referredEmail: email,
        saleAmount: paymentResult.amount as number,
        paymentRef: extractPaymentRef(body),
      });
      if (r.recorded) referralPaid = { commission: r.commission };
    } catch (e) {
      console.error("[ghl referral]", e instanceof Error ? e.message : e);
    }
  }
  const referralLine = referralPaid ? { referral: referralPaid } : {};

  let clickupResult: { taskId: string; url: string } | null = null;
  if (isClickUpEnabled()) {
    try {
      clickupResult = await syncGhlEventToClickUp({
        email,
        event,
        tags,
        contactId:
          (typeof body.contact_id === "string" && body.contact_id) ||
          (typeof body.id === "string" && body.id) ||
          undefined,
      });
    } catch (e) {
      console.error("[ghl clickup]", e instanceof Error ? e.message : e);
    }
  }

  const clickupLine = clickupResult
    ? `\n[${stamp}] ClickUp task: ${clickupResult.url}`
    : "";
  const line = `[${stamp}] GHL ${event}${tags.length ? `: ${tags.join(", ")}` : ""}${clickupLine}`;

  const { data: rows } = await supabase
    .from("active_customers")
    .select("id, service_notes")
    .ilike("email", email)
    .limit(1);

  if (rows?.[0]) {
    const prev = String(rows[0].service_notes ?? "").trim();
    const service_notes = prev ? `${prev}\n${line}` : line;
    await supabase.from("active_customers").update({ service_notes }).eq("id", rows[0].id);
    return NextResponse.json({
      ok: true,
      updated: "active_customers",
      ...(paymentResult?.recorded ? { payment: paymentResult } : {}),
      ...(clickupResult ? { clickup: clickupResult } : {}),
      ...tokenLine,
      ...referralLine,
    });
  }

  const { data: leads } = await supabase
    .from("incoming_leads")
    .select("id, notes")
    .ilike("email", email)
    .limit(1);

  if (leads?.[0]) {
    const prev = String((leads[0] as { notes?: string }).notes ?? "").trim();
    const notes = prev ? `${prev}\n${line}` : line;
    await supabase.from("incoming_leads").update({ notes }).eq("id", leads[0].id);
    return NextResponse.json({
      ok: true,
      updated: "incoming_leads",
      ...(paymentResult?.recorded ? { payment: paymentResult } : {}),
      ...(clickupResult ? { clickup: clickupResult } : {}),
      ...tokenLine,
      ...referralLine,
    });
  }

  if (paymentResult?.recorded || clickupResult || tokenTopup?.topped_up) {
    return NextResponse.json({
      ok: true,
      ...(paymentResult?.recorded ? { payment: paymentResult } : {}),
      ...(clickupResult ? { clickup: clickupResult } : {}),
      ...tokenLine,
      ...referralLine,
    });
  }

  return NextResponse.json({ ok: true, skipped: "no matching contact" });
}
