import { BASE_PROMPT } from './base-prompt'
import { VOICE_CHANNEL_ADDENDUM } from './bella-voice'
import type { OrgContext } from '../tenant'

export type AgentChannel = 'sms' | 'voice'

export interface ConversationContext {
  currentState: string
  sku?: string
  channel?: AgentChannel
  lastTurns: Array<{ direction: 'in' | 'out'; body: string }>
}

interface OverlayShape {
  tone_adjustment?: string
  forbidden_phrases?: string[]
  hot_lead_keywords?: string[]
}

export function buildSystemPrompt(org: OrgContext, ctx: ConversationContext): string {
  const overlay = (org.agentPersonaOverlay ?? {}) as OverlayShape
  const toneLine = overlay.tone_adjustment ? `Tone adjustment: ${overlay.tone_adjustment}.` : ''
  const hotKw = overlay.hot_lead_keywords?.length
    ? `If the lead says any of: ${overlay.hot_lead_keywords.join(', ')} — escalate to human immediately.`
    : ''
  const turns = ctx.lastTurns.slice(-10)
    .map((t) => `${t.direction === 'in' ? 'Lead' : 'You'}: ${t.body}`)
    .join('\n')

  const channelBlock = ctx.channel === 'voice' ? VOICE_CHANNEL_ADDENDUM : ''

  return `${BASE_PROMPT}
${channelBlock}

You are ${org.agentName} from ${org.tenantBrand}.
${toneLine}
${hotKw}

Current state: ${ctx.currentState}
SKU under discussion: ${ctx.sku ?? 'unknown'}
Channel: ${ctx.channel ?? 'sms'}

Conversation so far:
${turns || '(none yet — this is the first inbound)'}
`
}
