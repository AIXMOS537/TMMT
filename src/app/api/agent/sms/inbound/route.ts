/**
 * POST /api/agent/sms/inbound
 * Twilio SMS inbound webhook. Per-tenant routing by To number → organization.
 * Returns TwiML so Twilio can speak the agent's reply back.
 */
import { NextResponse } from 'next/server'
import { resolveOrgByTwilioNumber, OrgNotFoundError } from '@/lib/agent/tenant'
import { processInbound } from '@/lib/agent/process-inbound'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
import { LicenseDisabledError, OperationalKillError } from '@/lib/agent/guard'
import { handoffToHuman } from '@/lib/agent/handoff'

function twiml(body: string): string {
  if (!body) return '<Response/>'
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
}

function xmlResp(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { 'content-type': 'text/xml' } })
}

export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData()
  const from = String(form.get('From') ?? '')
  const to = String(form.get('To') ?? '')
  const body = String(form.get('Body') ?? '')
  if (!from || !to || !body) return xmlResp(twiml(''))

  let org
  try { org = await resolveOrgByTwilioNumber(to) }
  catch (e) {
    if (e instanceof OrgNotFoundError) return xmlResp(twiml(''))
    throw e
  }

  try {
    const db = createServiceSupabase()
    let { data: lead } = await db.from('incoming_leads')
      .select('*').eq('phone_e164', from).eq('organization_id', org.id).maybeSingle()
    if (!lead) {
      const ins = await db.from('incoming_leads')
        .insert({ organization_id: org.id, phone_e164: from, agent_status: 'NEW', source: 'twilio_inbound' })
        .select().single()
      lead = ins.data
    }

    let { data: conv } = await db.from('agent_conversations')
      .select('*').eq('lead_id', lead.id).is('ended_at', null).maybeSingle()
    if (!conv) {
      const cins = await db.from('agent_conversations')
        .insert({ lead_id: lead.id, organization_id: org.id, channel: 'sms' })
        .select().single()
      conv = cins.data
    }

    const { data: msgs } = await db.from('agent_messages')
      .select('direction, body')
      .eq('conversation_id', conv.id)
      .order('ts', { ascending: false })
      .limit(10)
    const recent = (msgs ?? []).reverse().map((m) => ({ direction: m.direction as 'in' | 'out', body: m.body }))

    await db.from('agent_messages').insert({ conversation_id: conv.id, direction: 'in', body })

    const result = await processInbound({
      org,
      prevState: lead.agent_status ?? 'NEW',
      sku: lead.sku ?? undefined,
      skuPriceCents: lead.sku_price_cents ?? undefined,
      inboundBody: body,
      phone: from,
      recentMessages: recent,
    })

    const patch: Record<string, unknown> = { agent_status: result.newState }
    if (!lead.contacted_at && result.newState !== 'NEW') patch.contacted_at = new Date().toISOString()
    if (result.newState === 'QUALIFIED' && !lead.qualified_at) patch.qualified_at = new Date().toISOString()
    if (result.newState === 'CLOSED') patch.closed_at = new Date().toISOString()
    if (result.newState === 'LOST') patch.lost_at = new Date().toISOString()
    if (result.complianceFlags.includes('opt_out')) {
      patch.opted_out = true
      patch.opted_out_at = new Date().toISOString()
    }
    await db.from('incoming_leads').update(patch).eq('id', lead.id)

    if (result.outboundBody) {
      await db.from('agent_messages').insert({
        conversation_id: conv.id,
        direction: 'out',
        body: result.outboundBody,
        compliance_flags: result.complianceFlags,
        llm_assessment: result.llmAssessment ?? null,
      })
    }

    if (result.newState === 'HUMAN_HANDOFF') {
      const allRecent = [...recent, { direction: 'in' as const, body }]
      if (result.outboundBody) allRecent.push({ direction: 'out' as const, body: result.outboundBody })
      handoffToHuman({
        org, leadId: lead.id, phone: from,
        reason: 'llm_escalated', recentMessages: allRecent,
      }).catch(() => undefined)
    }

    return xmlResp(twiml(result.outboundBody ?? ''))
  } catch (e) {
    if (e instanceof LicenseDisabledError || e instanceof OperationalKillError) {
      return xmlResp(twiml(''))
    }
    console.error('[agent/sms/inbound] error', e)
    return xmlResp(twiml(''))
  }
}
