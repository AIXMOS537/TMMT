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

export async function handleGhlVoiceAction(payload: GhlVoicePayload): Promise<{
  ok: boolean;
  action: VoiceAction;
  detail: string;
  data?: Record<string, unknown>;
}> {
  const action = payload.action;
  const locationKind = payload.location_kind ?? "rentals";
  const org = await resolveOrg(payload.org_slug);
  const contactId = await resolveContactId(payload, locationKind);
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
