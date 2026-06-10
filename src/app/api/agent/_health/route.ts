import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  if (process.env.B3_KILL_SWITCH === '1') {
    return NextResponse.json({ ok: false, status: 'killed' }, { status: 503 })
  }
  return NextResponse.json({
    ok: true,
    service: 'tmmt-agent-layer',
    ts: new Date().toISOString(),
    components: {
      license: ['/api/license/provision', '/api/license/heartbeat', '/api/license/revoke'],
      audit:   '/api/audit/events',
      agent:   ['/api/agent/sms/inbound', '/api/agent/stripe/webhook/[slug]', '/api/agent/cal/webhook/[slug]'],
      leads:   '/api/leads/webhook?org=<slug>',
    },
  })
}
