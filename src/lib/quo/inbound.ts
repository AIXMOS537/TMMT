import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-service";
import { logMemoryEvent } from "@/lib/memory";
import { detectWorkFromEvent } from "@/lib/routing/detect";
import { routeWork } from "@/lib/routing/assign";

/**
 * Quo Support Line → Brain → Dispatch (Phase 3a/3b).
 *
 * Quo is the SOLE backend support channel: one number clients call/text for
 * urgent help with the service they opted into at setup. Each inbound contact is
 * (1) forwarded into the brain (memory_events), (2) gated by the caller's
 * opted-in service, (3) classified by the routing detector, and (4) turned into
 * a support `cases` row ready for the evaluate/plan/route agent.
 *
 * Capture must never throw back to the webhook — failures are logged and the
 * request returns a structured result instead.
 */

export type QuoInboundKind = "sms" | "call";

export interface NormalizedQuoEvent {
  kind: QuoInboundKind;
  externalId: string; // OpenPhone/Quo object id — used for idempotency
  fromPhone: string; // E.164
  toPhone?: string;
  text?: string; // message body or call transcript/summary
  occurredAt?: string;
}

export interface QuoIngestResult {
  ok: boolean;
  ignored?: boolean;
  caseId?: string | null;
  entityId?: string | null;
  covered?: boolean; // caller matched an opted-in service
  workType?: string;
  assigned?: boolean; // routed to a candidate
  assignedTo?: string;
  reason?: string;
}

/** Canonicalize a phone to E.164-ish so caller-id matches stored records. */
export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return digits ? "+" + digits : "";
}

/**
 * Normalize a raw Quo (OpenPhone) webhook body into our event shape, or null if
 * it isn't an inbound message/call we handle. Defensive about payload shape:
 * OpenPhone wraps the resource in `data.object`, with `type` like
 * "message.received" / "call.completed".
 */
export function parseQuoWebhook(body: unknown): NormalizedQuoEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const type = typeof b.type === "string" ? b.type : "";
  const data = (b.data ?? {}) as Record<string, unknown>;
  const obj = (data.object ?? data ?? {}) as Record<string, unknown>;

  const isMessage = type.startsWith("message") || obj.object === "message";
  const isCall = type.startsWith("call") || obj.object === "call";
  if (!isMessage && !isCall) return null;

  // Only handle inbound (client → us). Skip our own outbound.
  const direction = typeof obj.direction === "string" ? obj.direction : "incoming";
  if (direction && direction !== "incoming" && direction !== "inbound") return null;

  const externalId =
    (typeof obj.id === "string" && obj.id) ||
    (typeof b.id === "string" && b.id) ||
    "";
  if (!externalId) return null;

  const fromPhone = normalizePhone(
    (typeof obj.from === "string" && obj.from) ||
      (typeof (obj.from as Record<string, unknown>)?.phoneNumber === "string" &&
        ((obj.from as Record<string, unknown>).phoneNumber as string)) ||
      ""
  );

  const toRaw = obj.to;
  const toPhone = normalizePhone(
    Array.isArray(toRaw)
      ? (toRaw[0] as string)
      : typeof toRaw === "string"
      ? toRaw
      : ""
  );

  const text =
    (typeof obj.body === "string" && obj.body) ||
    (typeof obj.text === "string" && obj.text) ||
    (typeof obj.summary === "string" && obj.summary) ||
    (typeof obj.transcript === "string" && obj.transcript) ||
    undefined;

  const occurredAt =
    (typeof obj.createdAt === "string" && obj.createdAt) ||
    (typeof obj.completedAt === "string" && obj.completedAt) ||
    undefined;

  return {
    kind: isMessage ? "sms" : "call",
    externalId,
    fromPhone,
    toPhone,
    text,
    occurredAt,
  };
}

/**
 * Ingest one inbound Quo event: forward to brain, gate by opted-in service,
 * classify, and create a support case. Idempotent via dedupe_key.
 */
export async function ingestQuoInbound(
  event: NormalizedQuoEvent
): Promise<QuoIngestResult> {
  if (!event.fromPhone) return { ok: false, ignored: true, reason: "no caller phone" };

  const supabase = createServiceRoleClient();
  const dedupeKey = `quo:${event.kind === "sms" ? "msg" : "call"}:${event.externalId}`;

  try {
    // 1. Resolve (or create) the caller as a memory entity.
    let entityId: string | null = null;
    let entityName: string | null = null;
    let orgId: string | null = null;

    const { data: existing } = await supabase
      .from("memory_entities")
      .select("id, display_name, org_id")
      .eq("kind", "person")
      .eq("external_refs->>primary_phone", event.fromPhone)
      .limit(1)
      .maybeSingle();

    if (existing) {
      entityId = existing.id as string;
      entityName = (existing.display_name as string) ?? null;
      orgId = (existing.org_id as string) ?? null;
    }

    // 2. Gate by opted-in service (by caller phone).
    const { data: svc } = await supabase
      .from("customer_services")
      .select("id, org_id, customer_name, service_slug, service_name, tier, status")
      .eq("contact_phone", event.fromPhone)
      .in("status", ["active", "trial"])
      .order("opted_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const covered = !!svc;
    if (svc?.org_id) orgId = svc.org_id as string;
    if (!entityName && svc?.customer_name) entityName = svc.customer_name as string;

    // Create the entity now if it was unknown (so the brain has a stable noun).
    if (!entityId) {
      const { data: created } = await supabase
        .from("memory_entities")
        .insert({
          kind: "person",
          display_name: entityName || event.fromPhone,
          org_id: orgId,
          external_refs: {
            primary_phone: event.fromPhone,
            phones: [event.fromPhone],
            source: "quo",
          },
        })
        .select("id")
        .single();
      entityId = (created?.id as string) ?? null;
    }

    // 3. Forward the support contact into the brain.
    const summary = `Inbound Quo ${event.kind} support request from ${
      entityName || event.fromPhone
    }${covered ? ` (service: ${svc?.service_slug})` : " (no opted-in service found)"}`;
    await logMemoryEvent({
      action: "support_request",
      source: "quo",
      actorKind: "external",
      actorLabel: entityName || event.fromPhone,
      orgId,
      entityId,
      summary,
      details: {
        kind: event.kind,
        from: event.fromPhone,
        to: event.toPhone,
        text: event.text,
        covered,
        service: svc?.service_slug ?? null,
        tier: svc?.tier ?? null,
      },
      dedupeKey,
      occurredAt: event.occurredAt,
    });

    // 4. Classify the work (pure detector — safe, no external deps).
    const detection = detectWorkFromEvent({
      source: "quo",
      tags: ["support", "urgent", svc?.service_slug].filter(Boolean) as string[],
      businessLine: svc?.service_slug,
    });

    // 5. Create the support case, ready for the evaluate/plan/route agent.
    const status = covered ? "received" : "needs_triage";
    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .insert({
        customer_name: entityName || event.fromPhone,
        customer_phone: event.fromPhone,
        request_type: "support",
        subject: `Urgent support — ${svc?.service_name || svc?.service_slug || "unverified service"}`,
        description: event.text || `Inbound ${event.kind} via Quo support line`,
        status,
        work_type: detection.workType,
        case_type: detection.caseType,
        routing_status: "detected",
        business_line: svc?.service_slug ?? null,
        required_capabilities: [svc?.service_slug, "support"].filter(Boolean) as string[],
        metadata: {
          channel: "quo",
          quo_external_id: event.externalId,
          covered,
          service: svc?.service_slug ?? null,
          detection,
          entity_id: entityId,
        },
      })
      .select("id")
      .single();

    if (caseErr) {
      console.error("[quo] case insert failed:", caseErr.message);
      return { ok: false, entityId, covered, reason: caseErr.message };
    }

    const caseId = (caseRow?.id as string) ?? null;

    // 6. Audit the routing handoff back into the brain.
    await logMemoryEvent({
      action: "support_case_created",
      source: "quo",
      actorKind: "system",
      actorLabel: "support router",
      orgId,
      entityId,
      summary: `Support case ${caseId} created (${detection.workType}, ${status})`,
      details: { caseId, workType: detection.workType, covered, ruleId: detection.ruleId },
      dedupeKey: `${dedupeKey}:case`,
    });

    // 7. Route covered support requests to the best candidate (full pool).
    //    Uncovered callers stay in manual triage (no auto-assignment).
    let assigned = false;
    let assignedTo: string | undefined;
    if (covered && caseId) {
      const routed = await routeWork(caseId, { entityId, orgId });
      assigned = routed.assigned;
      assignedTo = routed.displayName;
    }

    return {
      ok: true,
      caseId,
      entityId,
      covered,
      workType: detection.workType,
      assigned,
      assignedTo,
    };
  } catch (err) {
    console.error("[quo] ingest threw:", (err as Error).message);
    return { ok: false, reason: (err as Error).message };
  }
}
