/**
 * GHL Voice AI custom-action handler.
 * Called mid-call when Bella triggers qualify_lead, book_handoff, escalate_human, tag_vertical.
 */
import {
  addContactTag,
  findGhlContactByPhone,
  isGhlConfigured,
  updateContactCustomFields,
  type GhlLocationKind,
} from "@/lib/ghl/client";
import { handoffToHuman } from "@/lib/agent/handoff";
import { processInbound } from "@/lib/agent/process-inbound";
import { createServiceSupabase } from "@/lib/agent/supabase-server";
import { resolveOrgBySlug, type OrgContext } from "@/lib/agent/tenant";
import { BELLA_AGENT_NAME } from "@/lib/agent/persona/bella-voice";

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

const VERTICAL_TAGS: Record<string, string> = {
  rentals: "bella-set",
  detailing: "bella-set",
  credit: "bella-set",
  funding: "bella-set",
  moving: "bella-set",
  cleaning: "bella-set",
};

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
      await addContactTag(contactId, baseTag, locationKind);
      await addContactTag(contactId, `vertical:${vertical}`, locationKind);
      if (payload.caller_name) {
        await updateContactCustomFields(
          contactId,
          { bella_vertical: vertical, bella_last_touch: new Date().toISOString() },
          locationKind
        );
      }
      return { ok: true, action, detail: `tagged:${vertical}`, data: { contact_id: contactId } };
    }

    case "qualify_lead": {
      if (!contactId) return { ok: false, action, detail: "contact_not_found" };
      await addContactTag(contactId, "bella-qualified", locationKind);
      await addContactTag(contactId, baseTag, locationKind);
      await updateContactCustomFields(
        contactId,
        {
          bella_vertical: vertical,
          bella_qualified_at: new Date().toISOString(),
        },
        locationKind
      );
      return { ok: true, action, detail: "qualified", data: { contact_id: contactId, vertical } };
    }

    case "book_handoff": {
      if (!contactId) return { ok: false, action, detail: "contact_not_found" };
      const tags = ["bella-booked", baseTag, `vertical:${vertical}`];
      for (const t of tags) await addContactTag(contactId, t, locationKind);
      const fields: Record<string, string> = {
        bella_vertical: vertical,
        bella_booked_at: new Date().toISOString(),
      };
      if (payload.appointment_time) fields.bella_appointment = payload.appointment_time;
      await updateContactCustomFields(contactId, fields, locationKind);

      if (phone) {
        const db = createServiceSupabase();
        let { data: lead } = await db
          .from("incoming_leads")
          .select("*")
          .eq("phone_e164", phone)
          .eq("organization_id", org.id)
          .maybeSingle();
        if (!lead) {
          const ins = await db
            .from("incoming_leads")
            .insert({
              organization_id: org.id,
              phone_e164: phone,
              agent_status: "QUALIFIED",
              source: "ghl_voice",
            })
            .select()
            .single();
          lead = ins.data;
        } else {
          await db
            .from("incoming_leads")
            .update({ agent_status: "QUALIFIED", qualified_at: new Date().toISOString() })
            .eq("id", lead.id);
        }
        if (lead) {
          handoffToHuman({
            org,
            leadId: lead.id,
            phone,
            reason: "bella_voice_booked",
            recentMessages: payload.transcript_snippet
              ? [{ direction: "in", body: payload.transcript_snippet }]
              : [],
          }).catch(() => undefined);
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
        handoffToHuman({
          org,
          leadId: contactId,
          phone,
          reason: "voice_escalation",
          recentMessages: payload.transcript_snippet
            ? [{ direction: "in", body: payload.transcript_snippet }]
            : [],
        }).catch(() => undefined);
      }
      return { ok: true, action, detail: "escalated", data: { contact_id: contactId } };
    }

    case "post_call_summary": {
      const snippet = payload.transcript_snippet?.trim();
      if (!snippet || !phone) {
        return { ok: true, action, detail: "no_transcript" };
      }

      const db = createServiceSupabase();
      let { data: lead } = await db
        .from("incoming_leads")
        .select("*")
        .eq("phone_e164", phone)
        .eq("organization_id", org.id)
        .maybeSingle();

      if (!lead) {
        const ins = await db
          .from("incoming_leads")
          .insert({
            organization_id: org.id,
            phone_e164: phone,
            agent_status: "CONTACTED",
            source: "ghl_voice",
            contacted_at: new Date().toISOString(),
          })
          .select()
          .single();
        lead = ins.data;
      }

      if (!lead) return { ok: false, action, detail: "lead_create_failed" };

      let { data: conv } = await db
        .from("agent_conversations")
        .select("*")
        .eq("lead_id", lead.id)
        .is("ended_at", null)
        .maybeSingle();

      if (!conv) {
        const cins = await db
          .from("agent_conversations")
          .insert({ lead_id: lead.id, organization_id: org.id, channel: "voice" })
          .select()
          .single();
        conv = cins.data;
      }

      if (conv) {
        await db.from("agent_messages").insert({
          conversation_id: conv.id,
          direction: "in",
          body: snippet,
        });

        const result = await processInbound({
          org,
          prevState: lead.agent_status ?? "CONTACTED",
          inboundBody: snippet,
          phone,
          channel: "voice",
          recentMessages: [{ direction: "in", body: snippet }],
        });

        if (result.outboundBody) {
          await db.from("agent_messages").insert({
            conversation_id: conv.id,
            direction: "out",
            body: result.outboundBody,
            compliance_flags: result.complianceFlags,
          });
        }

        await db
          .from("incoming_leads")
          .update({ agent_status: result.newState })
          .eq("id", lead.id);
      }

      if (contactId) {
        await addContactTag(contactId, "bella-voice-call", locationKind);
      }

      return { ok: true, action, detail: "transcript_logged", data: { lead_id: lead.id } };
    }

    default:
      return { ok: false, action, detail: "unknown_action" };
  }
}
