/**
 * GHL Voice AI lead upsert + conversation/message logging.
 * Extracted from book_handoff and post_call_summary — same supabase + processInbound args.
 */
import { processInbound } from "@/lib/agent/process-inbound";
import { createServiceSupabase } from "@/lib/agent/supabase-server";
import type { OrgContext } from "@/lib/agent/tenant";

export interface VoiceLeadRow {
  id: string;
  agent_status?: string | null;
  [key: string]: unknown;
}

/** book_handoff: QUALIFIED + source ghl_voice. Returns the lead row or null. */
export async function upsertBookHandoffLead(
  orgId: string,
  phone: string
): Promise<VoiceLeadRow | null> {
  const db = createServiceSupabase();
  let { data: lead } = await db
    .from("incoming_leads")
    .select("*")
    .eq("phone_e164", phone)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!lead) {
    const ins = await db
      .from("incoming_leads")
      .insert({
        organization_id: orgId,
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
  return lead;
}

/** post_call_summary: CONTACTED + channel voice + processInbound. */
export async function logPostCallSummary(args: {
  org: OrgContext;
  phone: string;
  snippet: string;
}): Promise<{ lead: VoiceLeadRow } | { error: "lead_create_failed" }> {
  const { org, phone, snippet } = args;
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

  if (!lead) return { error: "lead_create_failed" };

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

  return { lead };
}
