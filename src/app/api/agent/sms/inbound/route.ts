/**
 * POST /api/agent/sms/inbound
 * Twilio SMS inbound webhook. Per-tenant routing by To number → organization.
 * Returns TwiML so Twilio can speak the agent's reply back.
 *
 * Order of guards, and why each sits where it does:
 *   signature → parse → org → lead/conversation → REPLAY GATE → record inbound
 *   → COMMUNICATION CONTROL (STOP keyword → suppress; START; stop-like → hold)
 *   → OPTED-OUT GUARD → OUTBOUND GATE (A2P + do-not-contact) → agent → reply.
 * Communication control sits before every AI guard and the LLM: honouring a
 * stop never depends on the licence, the kill switch, the spend cap or the
 * model. Everything expensive or customer-visible (the LLM call, the state
 * transition, the human handoff, the AI reply) sits after every guard.
 */
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOrgByTwilioNumber, OrgNotFoundError, type OrgContext } from '@/lib/agent/tenant'
import { processInbound } from '@/lib/agent/process-inbound'
import { createServiceRoleClient } from '@/lib/supabase-service'
import {
  LicenseDisabledError, OperationalKillError, LlmCapExceededError, isOperationalKillEngaged,
} from '@/lib/agent/guard'
import { handoffToHuman } from '@/lib/agent/handoff'
import { emitAudit } from '@/lib/agent/audit'
import { isOptInMessage, optOutAutoReply } from '@/lib/agent/compliance/opt-out'
import { recordGlobalOptOut } from '@/lib/agent/compliance/record-opt-out'
import { classifyCommunicationControl } from '@/lib/agent/compliance/communication-control'
import { assertOutboundAllowed, orgSmsVertical } from '@/lib/outbound-gate'

function twiml(body: string): string {
  if (!body) return '<Response/>'
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
}

function xmlResp(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { 'content-type': 'text/xml' } })
}

/**
 * May a FIXED compliance acknowledgement (never AI text) go out? The kill
 * switch and the outbound gate (do-not-contact, opt-out) still apply to the
 * acknowledgement. A refusal or a gate error withholds only the
 * acknowledgement; the caller records the opt-out / opt-in regardless.
 */
async function complianceAckDecision(
  db: SupabaseClient,
  phone: string,
  org: OrgContext,
): Promise<{ allowed: boolean; flags: string[] }> {
  if (isOperationalKillEngaged()) return { allowed: false, flags: ['ack_withheld_kill_switch'] }
  try {
    const d = await assertOutboundAllowed({
      db, phone, organizationId: org.id, vertical: orgSmsVertical(org), type: 'transactional',
    })
    return { allowed: d.allowed, flags: d.allowed ? d.flags : [...d.flags, 'ack_withheld'] }
  } catch (e) {
    console.warn('[agent/sms/inbound] acknowledgement gate errored; withholding the acknowledgement only', e)
    return { allowed: false, flags: ['ack_withheld_gate_error'] }
  }
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
  // Twilio always POSTs application/x-www-form-urlencoded. formData() throws a
  // TypeError on any other Content-Type, and that used to escape as a 500 --
  // a crash where a rejection belongs, on a public unauthenticated route.
  //
  // 400, deliberately, NOT the empty-TwiML 200 used for signature failures
  // below. The signature drop is silent so Twilio does not retry-flood and so
  // the response leaks nothing about WHY it dropped. A body we cannot parse is
  // a different thing: it is the caller's error, it can never be a genuine
  // Twilio delivery, and answering 200 would make a misconfigured sender look
  // like success -- which is exactly how the lead webhook stayed dead for 13
  // days. Twilio treats 4xx as permanent and will not retry it.
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    console.warn('[agent/sms/inbound] rejected: body was not form-encoded')
    return new NextResponse(null, { status: 400 })
  }

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
    const db = createServiceRoleClient()
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
    // timestamp and no nonce, so verification cannot reject a replay. The
    // MessageSid is recorded in agent_messages.metadata (the table has no
    // dedicated column in production). Two layers:
    //   soft — look the sid up before doing anything else;
    //   hard — once the staged unique expression index on
    //          metadata->>'provider_message_sid' is applied, the INSERT itself
    //          fails with 23505 and closes the race the lookup leaves open.
    // `recent` is read ABOVE this on purpose: the current message must not
    // appear in its own conversation context.
    if (messageSid) {
      const seen = await db.from('agent_messages')
        .select('id')
        .eq('conversation_id', conv.id)
        .eq('metadata->>provider_message_sid', messageSid)
        .limit(1)
        .maybeSingle()
      if (seen.data) {
        console.warn('[agent/sms/inbound] duplicate MessageSid, dropping replay')
        return xmlResp(twiml(''))
      }
    }
    const inboundInsert = await db.from('agent_messages').insert({
      conversation_id: conv.id,
      direction: 'in',
      body,
      metadata: messageSid ? { provider_message_sid: messageSid } : {},
    })
    if (inboundInsert.error) {
      // 23505 = unique violation = this MessageSid was already processed.
      if (inboundInsert.error.code === '23505') {
        console.warn('[agent/sms/inbound] duplicate MessageSid (index), dropping replay')
        return xmlResp(twiml(''))
      }
      throw inboundInsert.error
    }

    // ── COMMUNICATION CONTROL ──────────────────────────────────────────────
    // Deterministic, and ahead of every AI guard (kill switch, licence, LLM
    // spend cap) and the LLM. Before this, keyword STOP was only detected
    // inside processInbound AFTER those guards, so a guard failure meant the
    // opt-out was never recorded, and "stop texting me" went to the LLM and got
    // an ordinary reply. See compliance/communication-control.ts.
    const control = classifyCommunicationControl(body)

    // Explicit opt-out keyword: record suppression, never call the LLM.
    if (control.kind === 'opt_out') {
      if (lead.opted_out) {
        console.warn('[agent/sms/inbound] opt-out keyword from an already opted-out lead, no reply sent')
        return xmlResp(twiml(''))
      }
      // Ask about the acknowledgement BEFORE writing the flag: the gate reads
      // opted_out and would refuse it afterwards. A refusal or gate error only
      // withholds the acknowledgement; it never skips the suppression below.
      const ack = await complianceAckDecision(db, from, org)
      const now = new Date().toISOString()
      const suppressed = await db.from('incoming_leads')
        .update({ opted_out: true, opted_out_at: now, agent_status: 'LOST', lost_at: now })
        .eq('id', lead.id)
      if (suppressed.error) {
        console.error('[agent/sms/inbound] OPT-OUT NOT RECORDED', suppressed.error.message)
        await emitAudit({
          organizationId: org.id,
          action: 'compliance.opt_out_record_failed',
          payload: { lead_id: lead.id, conversation_id: conv.id, message: suppressed.error.message },
        })
        return xmlResp(twiml(''))
      }
      // ── STOP REACHES THE GLOBAL LIST ─────────────────────────────────────
      // The update above is scoped to ONE lead row in ONE org.
      // do_not_contact_numbers is what assertOutboundAllowed() checks for every
      // org on every outbound message, so without this a re-imported lead row
      // (opted_out defaulting to false) or a different org could text this
      // person again. A person who says stop means stop, not "stop from this
      // record".
      //
      // This path returns early — deliberately, so an opt-out never reaches the
      // LLM — which means it does NOT fall through to the global write further
      // down this file. Merging C-21a with that write in place without adding
      // this call here would have silently dropped it for every keyword STOP.
      //
      // Failure is recorded, not thrown: the suppression above already landed,
      // and losing the customer's reply on top of a compliance-write failure
      // helps nobody. It must not be invisible either.
      const dncFlags: string[] = []
      const dnc = await recordGlobalOptOut(db, from, 'inbound STOP via SMS agent')
      if (!dnc.ok) {
        dncFlags.push('dnc_write_failed')
        console.error('[agent/sms/inbound] GLOBAL DNC WRITE FAILED', dnc.error)
        await emitAudit({
          organizationId: org.id,
          action: 'compliance.dnc_write_failed',
          payload: { lead_id: lead.id, conversation_id: conv.id, phone_last4: from.slice(-4) },
        })
      }

      await emitAudit({
        organizationId: org.id,
        action: 'compliance.opt_out_received',
        payload: {
          lead_id: lead.id,
          conversation_id: conv.id,
          ack_sent: ack.allowed,
          global_dnc: dnc.ok,
        },
      })
      const ackBody = ack.allowed ? optOutAutoReply() : ''
      await db.from('agent_messages').insert({
        conversation_id: conv.id,
        direction: 'out',
        body: ackBody,
        compliance_flags: ['opt_out', ...ack.flags, ...dncFlags],
      })
      return xmlResp(twiml(ackBody))
    }

    // ── OPT-IN ─────────────────────────────────────────────────────────────
    // The opt-out auto-reply promises "Reply START anytime to opt back in".
    // START clears only this org's per-lead flag. It does not touch
    // do_not_contact_numbers, and Twilio's own opt-out state is separate.
    // The fixed confirmation goes through the same acknowledgement check as
    // STOP, so it is not sent to a do-not-contact number or while the kill
    // switch is engaged (it used to be sent in both cases).
    if (control.kind === 'opt_in') {
      if (lead.opted_out) {
        await db.from('incoming_leads')
          .update({ opted_out: false, opted_out_at: null })
          .eq('id', lead.id)
      }
      const ack = await complianceAckDecision(db, from, org)
      await emitAudit({
        organizationId: org.id,
        action: 'compliance.opt_in_received',
        payload: { lead_id: lead.id, conversation_id: conv.id, was_opted_out: Boolean(lead.opted_out), ack_sent: ack.allowed },
      })
      return xmlResp(twiml(ack.allowed ? "You're opted back in. Reply STOP at any time to opt out." : ''))
    }

    // ── OPT-OUT GUARD ──────────────────────────────────────────────────────
    // opted_out was written but never read, so an opted-out person still got a
    // full LLM reply on their next message. The inbound message is recorded
    // above, so the audit trail stays complete — only the reply is withheld.
    if (lead.opted_out) {
      console.warn('[agent/sms/inbound] inbound from opted-out lead, no reply sent')
      return xmlResp(twiml(''))
    }

    // ── STOP-LIKE HOLD ─────────────────────────────────────────────────────
    // A stop signal that is not an explicit keyword ("stop texting me",
    // "take me off your list", "STOP ALL"). Not treated as a formal opt-out and
    // not interpreted by an LLM: held for a human, no reply of any kind.
    if (control.kind === 'stop_like') {
      console.warn(`[agent/sms/inbound] stop-like message held for human review (${control.signal})`)
      await db.from('agent_messages').insert({
        conversation_id: conv.id,
        direction: 'out',
        body: '',
        compliance_flags: ['stop_like_hold', `stop_signal:${control.signal}`],
      })
      await emitAudit({
        organizationId: org.id,
        action: 'compliance.stop_like_held',
        payload: { lead_id: lead.id, conversation_id: conv.id, signal: control.signal },
      })
      return xmlResp(twiml(''))
    }

    // ── OUTBOUND GATE ──────────────────────────────────────────────────────
    // The TwiML reply is an outbound customer message even though it never
    // touches a send API, so it goes through the same door as sendSms(): the
    // A2P gate (transactional here — it answers a message the customer sent)
    // and the do-not-contact list. Refusal is silent to the sender and logged.
    const outbound = await assertOutboundAllowed({
      db,
      phone: from,
      organizationId: org.id,
      vertical: orgSmsVertical(org),
      type: 'transactional',
    })
    if (!outbound.allowed) {
      console.warn(`[agent/sms/inbound] reply withheld by outbound gate: ${outbound.reason}`)
      await db.from('agent_messages').insert({
        conversation_id: conv.id,
        direction: 'out',
        body: '',
        compliance_flags: outbound.flags,
      })
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

    // ── STOP REACHES THE GLOBAL LIST ───────────────────────────────────────
    // The patch above is scoped to ONE lead row in ONE org. do_not_contact_numbers
    // is what assertOutboundAllowed() checks on every outbound message for every
    // org, and nothing in this codebase wrote to it — so a re-imported lead row
    // (opted_out defaulting to false) or a different org could text this person
    // again. A person who says stop means stop, not "stop from this record".
    // Failure is recorded on the message instead of thrown: the customer's reply
    // must not be lost because a compliance write failed, but it must not be
    // invisible either.
    if (result.complianceFlags.includes('opt_out')) {
      const dnc = await recordGlobalOptOut(db, from, 'inbound STOP via SMS agent')
      if (!dnc.ok) result.complianceFlags.push('dnc_write_failed')
    }

    if (result.outboundBody) {
      await db.from('agent_messages').insert({
        conversation_id: conv.id,
        direction: 'out',
        body: result.outboundBody,
        compliance_flags: [...result.complianceFlags, ...outbound.flags],
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
