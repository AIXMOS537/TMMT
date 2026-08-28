import {
  addContactTag,
  createOutboundGhlOpportunity,
  isGhlConfigured,
  upsertOutboundGhlContact,
  type GhlLocationKind,
} from "@/lib/ghl/client";
import { resolveDoor, MASTER_PIPELINE, type DoorResolveInput } from "./doors";

export type DoorRouteInput = DoorResolveInput & {
  name: string;
  email?: string | null;
  phone?: string | null;
  opportunityName?: string | null;
  source?: string | null;
};

export type DoorRouteResult = {
  ok: boolean;
  doorId: string;
  contactId: string | null;
  opportunityId: string | null;
  skipped?: string;
};

function pipelineNameFor(door: { family: string; pipelineName: string | null }): string | null {
  if (!door.pipelineName) return null;
  if (door.family === "dealer") {
    return process.env.GHL_DEALER_PIPELINE_NAME?.trim() || door.pipelineName;
  }
  if (door.pipelineName === MASTER_PIPELINE) {
    return process.env.GHL_MASTER_PIPELINE_NAME?.trim() || door.pipelineName;
  }
  return door.pipelineName;
}

/**
 * Push a saved lead onto the GHL pipeline for its door.
 * Fail-open: never throws to the caller. Never sends SMS/email.
 * Legal-gated doors (credit/funding) get an inquiry tag only — no opportunity.
 */
export async function routeDoorToPipeline(input: DoorRouteInput): Promise<DoorRouteResult> {
  const door = resolveDoor(input);
  const location = door.location as GhlLocationKind;

  if (!isGhlConfigured(location)) {
    return { ok: false, doorId: door.id, contactId: null, opportunityId: null, skipped: "ghl_not_configured" };
  }

  if (!input.email?.trim() && !input.phone?.trim()) {
    return { ok: false, doorId: door.id, contactId: null, opportunityId: null, skipped: "no_identifier" };
  }

  try {
    const contactId = await upsertOutboundGhlContact({
      name: input.name.trim() || "Unknown",
      email: input.email,
      phone: input.phone,
      tags: door.tags,
      source: input.source?.trim() || `door:${door.id}`,
      locationKind: location,
    });

    if (!contactId) {
      return { ok: false, doorId: door.id, contactId: null, opportunityId: null, skipped: "contact_unresolved" };
    }

    if (door.legalGate !== "none") {
      return {
        ok: true,
        doorId: door.id,
        contactId,
        opportunityId: null,
        skipped: "legal_gate_l1_l10",
      };
    }

    const pipelineName = pipelineNameFor(door);
    if (!pipelineName) {
      return { ok: true, doorId: door.id, contactId, opportunityId: null, skipped: "no_pipeline" };
    }

    const opportunityId = await createOutboundGhlOpportunity({
      contactId,
      name: input.opportunityName?.trim() || `${door.id} · ${input.name.trim() || "lead"}`,
      pipelineName,
      stageName: door.stageName,
      locationKind: location,
    });

    if (!opportunityId) {
      await addContactTag(contactId, "pipeline-unresolved", location).catch(() => undefined);
      return { ok: true, doorId: door.id, contactId, opportunityId: null, skipped: "pipeline_unresolved" };
    }

    return { ok: true, doorId: door.id, contactId, opportunityId };
  } catch (err) {
    console.warn("[door-router] fail-open", door.id, err);
    return {
      ok: false,
      doorId: door.id,
      contactId: null,
      opportunityId: null,
      skipped: err instanceof Error ? err.message : "ghl_error",
    };
  }
}

/** Fire-and-forget wrapper for form/webhook call sites. Never rejects. */
export function enqueueDoorRoute(input: DoorRouteInput): void {
  void routeDoorToPipeline(input).catch((err) => {
    console.warn("[door-router] enqueue failed", err);
  });
}
