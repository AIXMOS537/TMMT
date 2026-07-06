/**
 * First outbound SMS after lead capture (B3 ≤60s path).
 * Called from POST /api/leads/webhook after lead.received audit.
 */
import type { OrgContext } from './tenant'
import { sendSms } from './twilio-send'
import { isQuietHours } from './compliance/quiet-hours'
import { emitAudit } from './audit'
import { createServiceSupabase } from './supabase-server'
import { step } from './state-machine'

const SKU_HOOK: Record<string, string> = {
  'lead-magnet': 'the free Credit + Funding Playbook',
  'intro-97': 'the $97 credit + funding audit',
  training: 'TMMT Operator Academy',
  'rental-in-a-box': 'Rental-in-a-Box',
  flagship: 'the flagship program',
}

export interface TriggerFirstOutboundArgs {
  org: OrgContext
  leadId: string
  phoneE164: string
  contactName?: string | null
  sku: string
  skuPriceCents: number
  ip?: string | null
}

export async function triggerFirstOutbound(
  args: TriggerFirstOutboundArgs,
): Promise<{ sent: boolean; reason?: string }> {
  const db = createServiceSupabase()
  const { data: lead } = await db
    .from('incoming_leads')
    .select('agent_status, contacted_at')
    .eq('id', args.leadId)
    .single()

  if (lead?.contacted_at || (lead?.agent_status && lead.agent_status !== 'NEW')) {
    return { sent: false, reason: 'already_contacted' }
  }

  if (isQuietHours(args.phoneE164)) {
    await emitAudit({
      organizationId: args.org.id,
      action: 'lead.outbound_deferred_quiet_hours',
      payload: { lead_id: args.leadId },
    })
    return { sent: false, reason: 'quiet_hours' }
  }

  const from = args.org.twilioInboundNumber
  if (!from) {
    await emitAudit({
      organizationId: args.org.id,
      action: 'lead.outbound_skipped_no_twilio',
      payload: { lead_id: args.leadId },
    })
    return { sent: false, reason: 'no_twilio_number' }
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    await emitAudit({
      organizationId: args.org.id,
      action: 'lead.outbound_skipped_no_twilio_env',
      payload: { lead_id: args.leadId },
    })
    return { sent: false, reason: 'no_twilio_env' }
  }

  const hook = SKU_HOOK[args.sku] ?? 'your request'
  const firstName = args.contactName?.trim().split(/\s+/)[0]
  const greeting = firstName ? `Hey ${firstName}` : 'Hey there'
  const body = `${greeting} — ${args.org.agentName} from ${args.org.tenantBrand}. You asked about ${hook}. Reply YES for the next step (STOP to opt out).`

  step({ state: 'NEW' }, { kind: 'lead_received', sku: args.sku, skuPriceCents: args.skuPriceCents })

  try {
    const { sid } = await sendSms({
      from,
      to: args.phoneE164,
      body,
      organizationId: args.org.id,
    })

    await db
      .from('incoming_leads')
      .update({
        agent_status: 'CONTACTED',
        contacted_at: new Date().toISOString(),
      })
      .eq('id', args.leadId)

    try {
      let { data: conv } = await db
        .from('agent_conversations')
        .select('id')
        .eq('lead_id', args.leadId)
        .is('ended_at', null)
        .maybeSingle()
      if (!conv) {
        const cins = await db
          .from('agent_conversations')
          .insert({
            lead_id: args.leadId,
            organization_id: args.org.id,
            channel: 'sms',
          })
          .select('id')
          .single()
        conv = cins.data
      }
      if (conv?.id) {
        await db.from('agent_messages').insert({
          conversation_id: conv.id,
          direction: 'out',
          body,
          provider_sid: sid,
        })
      }
    } catch {
      // Conversation tables may be prod-only; SMS already sent.
    }

    await emitAudit({
      organizationId: args.org.id,
      action: 'lead.contacted',
      ip: args.ip ?? null,
      payload: { lead_id: args.leadId, sku: args.sku, twilio_sid: sid },
    })
    return { sent: true }
  } catch (err) {
    await emitAudit({
      organizationId: args.org.id,
      action: 'lead.outbound_failed',
      payload: {
        lead_id: args.leadId,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return { sent: false, reason: 'send_failed' }
  }
}
