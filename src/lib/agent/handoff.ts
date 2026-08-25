import type { OrgContext } from './tenant'
import { redactPii } from './redact-pii'

/**
 * Hostname allowlist for Slack incoming webhooks. If the per-tenant
 * `handoff_slack_webhook` row is set to anything outside this allowlist
 * (e.g. via a malicious DB write or admin slip), the call is refused
 * and logged rather than silently exfiltrating lead PII to an attacker-
 * controlled URL.
 */
const SLACK_WEBHOOK_HOSTS = new Set(['hooks.slack.com'])

/**
 * Redact a phone number to last-4 for outbound notifications.
 * Conversation context still contains the digits the lead typed, but
 * the structured "Lead phone:" field is the most-exfiltratable element.
 */
function redactPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return `***-***-${digits.slice(-4)}`
}

export interface HandoffArgs {
  org: OrgContext
  leadId: string
  phone: string
  reason: string
  recentMessages: Array<{ direction: 'in' | 'out'; body: string }>
}

async function sendSlackHandoff(webhook: string, text: string): Promise<void> {
  let hostname: string
  try { hostname = new URL(webhook).hostname }
  catch { console.warn('[handoff.slack] invalid webhook URL — refusing'); return }
  if (!SLACK_WEBHOOK_HOSTS.has(hostname)) {
    console.warn(`[handoff.slack] non-allowlisted hostname=${hostname} — refusing`)
    return
  }
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) console.warn(`[handoff.slack] http ${res.status}`)
  } catch (err) {
    console.warn('[handoff.slack] fetch failed:', err instanceof Error ? err.message : String(err))
  }
}

async function sendImessageHandoff(target: string, text: string): Promise<void> {
  const relay = process.env.IMESSAGE_RELAY_URL
  const token = process.env.IMESSAGE_RELAY_TOKEN
  if (!relay) {
    // Expected in cloud (Vercel) — Tailscale-only relay is unreachable from prod
    // without a tunnel. Silent skip is intentional here.
    return
  }
  if (!token) {
    console.warn('[handoff.imessage] IMESSAGE_RELAY_URL set but IMESSAGE_RELAY_TOKEN missing — refusing')
    return
  }
  try {
    const res = await fetch(relay, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: target, text }),
    })
    if (!res.ok) console.warn(`[handoff.imessage] http ${res.status}`)
  } catch (err) {
    console.warn('[handoff.imessage] fetch failed:', err instanceof Error ? err.message : String(err))
  }
}

export async function handoffToHuman(args: HandoffArgs): Promise<void> {
  const summary = args.recentMessages
    .slice(-10)
    .map((m) => `${m.direction === 'in' ? '👤 Lead' : '🤖 Agent'}: ${redactPii(m.body)}`)
    .join('\n')

  const text = `🆘 Hot lead handoff — ${args.org.name}\nReason: ${args.reason}\nLead phone: ${redactPhone(args.phone)}\nLead id: ${args.leadId}\n\n${summary}`

  const slackP = args.org.handoffSlackWebhook
    ? sendSlackHandoff(args.org.handoffSlackWebhook, text)
    : Promise.resolve()

  const imessageP = args.org.handoffImessageTarget
    ? sendImessageHandoff(args.org.handoffImessageTarget, text)
    : Promise.resolve()

  await Promise.all([slackP, imessageP])
}
