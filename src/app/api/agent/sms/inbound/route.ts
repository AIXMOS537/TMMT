/**
 * POST /api/agent/sms/inbound
 * Twilio SMS inbound webhook. Per-tenant routing by To number → organization.
 * Returns TwiML so Twilio can speak the agent's reply back.
 */
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { resolveOrgByTwilioNumber, OrgNotFoundError } from '@/lib/agent/tenant'
import { processInbound } from '@/lib/agent/process-inbound'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
import { LicenseDisabledError, OperationalKillError, LlmCapExceededError } from '@/lib/agent/guard'
import { handoffToHuman } from '@/lib/agent/handoff'
import { isOptInMessage } from '@/lib/agent/compliance/opt-out'

function twiml(body: string): string {
  if (!body) return '<Response/>'
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
}

function xmlResp(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { 'content-type': 'text/xml' } })
}

/**
 * Twilio webhook signature verification per https://www.twilio.com/docs/usage/webhooks/webhooks-security
 * Fails closed: missing token or signature → reject. Silent-drop on mismatch (return empty TwiML 200)
 * so Twilio does not retry-flood the endpoint and the response leaks no info about why it dropped.
 */
function verifyTwilioSignature(req: Request, params: Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = req.headers.get('x-twilio-signature')
  if (!authToken || !signature) return false

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return false
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const path = new URL(req.url).pathname
  const url = `${proto}://${host}${path}`

  let toSign = url
  for (const k of Object.keys(params).sort()) toSign += k + params[k]

  const expected = createHmac('sha1', authToken).update(toSign).digest('base64')
  if (signature.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData()
  const flat: Record<string, string> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') flat[k] = v
  }

  if (!verifyTwilioSignature(req, flat)) {
    console.warn('[agent/sms/inbound] rejected: signature mismatch or missing TWILIO_AUTH_TOKEN')
    return xmlResp(twiml(''))
  }

  const from = flat.From ?? ''
  const to = flat.To ?? ''
  const body = flat.Body ?? ''
  // Twilio's per-message id, stable across Twilio's own retries — which is
  // exactly what makes it usable as a replay key.
  const messageSid = flat.MessageSid ?? flat.SmsMessageSid ?? ''
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

    // ── REPLAY GATE ────────────────────────────────────────────────────────
    // A correctly-signed request replays forever: Twilio signatures carry no
    // timestamp and no nonce, so verification cannot reject a replay. The unique
    // index on provider_message_sid makes this INSERT the gate. It sits before
    // the LLM call, the state transition and the outbound reply, so a duplicate
    // costs one rejected insert and nothing else.
    // `recent` is read ABOVE this on purpose: the current message must not
    // appear in its own conversation context.
    const inboundInsert = await db.from('agent_messages').insert({
      conversation_id: conv.id,
      direction: 'in',
      body,
      provider_message_sid: messageSid || null,
    })
    if (inboundInsert.error) {
      // 23505 = unique violation = this MessageSid was already processed.
      if (inboundInsert.error.code === '23505') {
        console.warn('[agent/sms/inbound] duplicate MessageSid, dropping replay')
        return xmlResp(twiml(''))
      }
      throw inboundInsert.error
    }

    // ── OPT-IN ─────────────────────────────────────────────────────────────
    // The opt-out auto-reply promises "Reply START anytime to opt back in".
    // Nothing honoured it: isOptInMessage() existed and was never called, and
    // opted_out was never cleared. Without this, the guard below would silence
    // someone permanently with no way back.
    if (isOptInMessage(body)) {
      if (lead.opted_out) {
        await db.from('incoming_leads')
          .update({ opted_out: false, opted_out_at: null })
          .eq('id', lead.id)
      }
      return xmlResp(twiml("You're opted back in. Reply STOP at any time to opt out."))
    }

    // ── OPT-OUT GUARD ──────────────────────────────────────────────────────
    // opted_out was written but never read, so an opted-out person still got a
    // full LLM reply on their next message. Carrier-level STOP is blocked by
    // Twilio upstream; isOptOutMessage() also catches app-level phrasing
    // ("stop texting me", "remove me") that carriers do NOT filter, and those
    // are the people this protects. The inbound message is recorded above, so
    // the audit trail stays complete — only the reply is withheld.
    if (lead.opted_out) {
      console.warn('[agent/sms/inbound] inbound from opted-out lead, no reply sent')
      return xmlResp(twiml(''))
    }

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
    if (
      e instanceof LicenseDisabledError ||
      e instanceof OperationalKillError ||
      e instanceof LlmCapExceededError
    ) {
      if (e instanceof LlmCapExceededError) console.warn('[agent/sms/inbound] llm cap exceeded:', e.message)
      return xmlResp(twiml(''))
    }
    console.error('[agent/sms/inbound] error', e)
    return xmlResp(twiml(''))
  }
}
