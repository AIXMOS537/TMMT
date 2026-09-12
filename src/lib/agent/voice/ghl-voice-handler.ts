/**
 * GHL Voice AI custom-action handler.
 * Called mid-call when Bella triggers qualify_lead, book_handoff, escalate_human, tag_vertical.
 */
import {
  addContactTag,
  findGhlContactByPhone,
  isGhlConfigured,
  type GhlLocationKind,
} from "@/lib/ghl/client";
import { resolveOrgBySlug, type OrgContext } from "@/lib/agent/tenant";
import { BELLA_AGENT_NAME } from "@/lib/agent/persona/bella-voice";
import { VERTICAL_TAGS, applyVerticalTags, bookTags, qualifyTags } from "./ghl-voice-tags";
import { logPostCallSummary, upsertBookHandoffLead } from "./ghl-voice-leads";
import { triggerBookedHandoff, triggerVoiceEscalation } from "./ghl-voice-handoff";
import { emitAudit } from "@/lib/agent/audit";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { seenVoiceEvent, voiceAuditAction } from "./voice-replay";

export type VoiceAction =
  | "qualify_lead"
  | "book_handoff"
  | "escalate_human"
  | "tag_vertical"
  | "post_call_summary";

export interface GhlVoicePayload {
  action: VoiceAction;
  phone?: string;
  contact_id?: string;
  /** GHL's call identifier, when the custom action is configured to send it.
   *  Present => exact replay protection. Absent => a short contact window. */
  call_id?: string;
  vertical?: string;
  transcript_snippet?: string;
  caller_name?: string;
  appointment_time?: string;
  location_kind?: GhlLocationKind;
  org_slug?: string;
}

function defaultOrg(): OrgContext {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    name: "TMMT",
    partnerAppSlug: "tmmt-rentals",
    agentName: BELLA_AGENT_NAME,
    tenantBrand: "TMMT",
    agentPersonaOverlay: {},
    handoffSlackWebhook: null,
    handoffImessageTarget: null,
    calComEventLink: null,
    stripeConnectAccountId: null,
    llmDailyCapUsd: 50,
    twilioInboundNumber: null,
  };
}

async function resolveOrg(slug?: string): Promise<OrgContext> {
  if (!slug) return defaultOrg();
  try {
    return await resolveOrgBySlug(slug);
  } catch {
    return defaultOrg();
  }
}

async function resolveContactId(
  payload: GhlVoicePayload,
  locationKind: GhlLocationKind
): Promise<string | null> {
  if (payload.contact_id?.trim()) return payload.contact_id.trim();
  if (!payload.phone?.trim() || !isGhlConfigured(locationKind)) return null;
  return findGhlContactByPhone(payload.phone, { location: locationKind, tryFallbackLocation: true });
}

type VoiceActionResult = {
  ok: boolean;
  action: VoiceAction;
  detail: string;
  data?: Record<string, unknown>;
};

/**
 * `org` and `contactId` are resolved ONCE by the caller and passed in.
 * Resolving them here as well meant two GHL contact lookups per webhook — an
 * extra network round trip on a live call, for the same answer.
 */
async function performVoiceAction(
  payload: GhlVoicePayload,
  org: OrgContext,
  contactId: string | null,
): Promise<{
  ok: boolean;
  action: VoiceAction;
  detail: string;
  data?: Record<string, unknown>;
}> {
  const action = payload.action;
  const locationKind = payload.location_kind ?? "rentals";
  const phone = payload.phone?.trim() ?? "";

  if (!contactId && action !== "post_call_summary") {
    return { ok: false, action, detail: "contact_not_found" };
  }


  const vertical = (payload.vertical ?? "general").toLowerCase();
  const baseTag = VERTICAL_TAGS[vertical] ?? "bella-set";

  switch (action) {
    case "tag_vertical": {
      if (!contactId) return { ok: false, action, detail: "contact_not_found" };
      await applyVerticalTags(contactId, baseTag, vertical, locationKind, payload.caller_name);
      return { ok: true, action, detail: `tagged:${vertical}`, data: { contact_id: contactId } };
    }

    case "qualify_lead": {
      if (!contactId) return { ok: false, action, detail: "contact_not_found" };
      await qualifyTags(contactId, baseTag, vertical, locationKind);
      return { ok: true, action, detail: "qualified", data: { contact_id: contactId, vertical } };
    }

    case "book_handoff": {
      if (!contactId) return { ok: false, action, detail: "contact_not_found" };
      await bookTags(contactId, baseTag, vertical, locationKind, payload.appointment_time);

      if (phone) {
        const lead = await upsertBookHandoffLead(org.id, phone);
        if (lead) {
          triggerBookedHandoff({
            org,
            leadId: lead.id,
            phone,
            transcriptSnippet: payload.transcript_snippet,
          });
        }
      }

      return {
        ok: true,
        action,
        detail: "booked_handoff_triggered",
        data: { contact_id: contactId, appointment_time: payload.appointment_time ?? null },
      };
    }

    case "escalate_human": {
      if (!contactId) return { ok: false, action, detail: "contact_not_found" };
      await addContactTag(contactId, "bella-escalate", locationKind);
      if (phone) {
        triggerVoiceEscalation({
          org,
          contactId,
          phone,
          transcriptSnippet: payload.transcript_snippet,
        });
      }
      return { ok: true, action, detail: "escalated", data: { contact_id: contactId } };
    }

    case "post_call_summary": {
      const snippet = payload.transcript_snippet?.trim();
      if (!snippet || !phone) {
        return { ok: true, action, detail: "no_transcript" };
      }

      const logged = await logPostCallSummary({ org, phone, snippet });
      if ("error" in logged) return { ok: false, action, detail: "lead_create_failed" };

      if (contactId) {
        await addContactTag(contactId, "bella-voice-call", locationKind);
      }

      return { ok: true, action, detail: "transcript_logged", data: { lead_id: logged.lead.id } };
    }

    default:
      return { ok: false, action, detail: "unknown_action" };
  }
}

/** Outcomes that report success while performing no side effect. */
const NO_OP_DETAILS = new Set(["no_transcript", "contact_not_found", "ghl_not_configured"]);

/**
 * The public entry point: replay check → action → audit.
 *
 * Order matters in both directions.
 *
 * The check runs BEFORE any side effect, because the whole point is to stop a
 * replayed book_handoff from booking twice.
 *
 * The audit is written AFTER, and ONLY when the action actually succeeded.
 * Writing it up front looked tidier and was wrong: a `post_call_summary` that
 * arrives with no transcript returns `no_transcript` having done nothing, and
 * an audit row for that no-op would sit in the replay window and suppress the
 * legitimate retry that carries the transcript. An action that did not happen
 * must not block the one that will. Caught by an existing test that asserted
 * this handler touches no database on that path.
 */
export async function handleGhlVoiceAction(
  payload: GhlVoicePayload,
): Promise<VoiceActionResult> {
  const org = await resolveOrg(payload.org_slug);
  const locationKind = payload.location_kind ?? "rentals";
  const contactId = await resolveContactId(payload, locationKind);
  const db = createServiceRoleClient();

  const replay = await seenVoiceEvent(db, {
    organizationId: org.id,
    action: payload.action,
    callId: payload.call_id,
    contactId,
  });
  if (replay.seen) {
    return {
      ok: true,
      action: payload.action,
      detail: `duplicate_ignored:${replay.keyed}`,
    };
  }

  const result = await performVoiceAction(payload, org, contactId);

  // The audit row is both the compliance trail — this handler emitted none at
  // all before — and the record the check above reads on the next delivery.
  //
  // `ok: true` is not the same as "something happened". post_call_summary
  // returns ok with detail `no_transcript` having done nothing at all, and
  // recording that would suppress the retry that carries the transcript.
  if (result.ok && !NO_OP_DETAILS.has(result.detail)) {
    await emitAudit({
      organizationId: org.id,
      action: voiceAuditAction(payload.action),
      payload: {
        call_id: payload.call_id ?? null,
        contact_id: contactId ?? null,
        vertical: payload.vertical ?? null,
        detail: result.detail,
      },
    });
  }

  return result;
}
