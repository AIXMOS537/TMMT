import type { OrgContext } from './tenant'

const IMESSAGE_RELAY_URL = process.env.IMESSAGE_RELAY_URL || 'http://100.77.126.8:8787/send'

export interface HandoffArgs {
  org: OrgContext
  leadId: string
  phone: string
  reason: string
  recentMessages: Array<{ direction: 'in' | 'out'; body: string }>
}

export async function handoffToHuman(args: HandoffArgs): Promise<void> {
  const summary = args.recentMessages
    .slice(-10)
    .map((m) => `${m.direction === 'in' ? '👤 Lead' : '🤖 Agent'}: ${m.body}`)
    .join('\n')

  const text = `🆘 Hot lead handoff — ${args.org.name}\nReason: ${args.reason}\nLead phone: ${args.phone}\nLead id: ${args.leadId}\n\n${summary}`

  const slackP = args.org.handoffSlackWebhook
    ? fetch(args.org.handoffSlackWebhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      }).catch(() => undefined)
    : Promise.resolve()

  const imessageP = args.org.handoffImessageTarget
    ? fetch(IMESSAGE_RELAY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: args.org.handoffImessageTarget, text }),
      }).catch(() => undefined)
    : Promise.resolve()

  await Promise.all([slackP, imessageP])
}
