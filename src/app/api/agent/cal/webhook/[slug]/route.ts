/**
 * POST /api/agent/cal/webhook/[slug]
 * Per-tenant Cal.com webhook. Verifies HMAC-SHA256 signature, advances lead state on BOOKING_CREATED.
 */
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { resolveOrgBySlug } from '@/lib/agent/tenant'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
import { guardOrganization, LicenseDisabledError } from '@/lib/agent/guard'
import { emitAudit } from '@/lib/agent/audit'

function verifyCalSignature(body: string, sig: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    if (sig.length !== expected.length) return false
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch { return false }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const { slug } = await params
  const sig = req.headers.get('x-cal-signature-256') ?? ''
  const secretEnvKey = `CAL_WEBHOOK_SECRET_${slug.toUpperCase().replace(/-/g, '_')}`
  const secret = process.env[secretEnvKey]
  if (!secret) return NextResponse.json({ error: `webhook secret ${secretEnvKey} not configured` }, { status: 500 })

  const body = await req.text()
  if (!verifyCalSignature(body, sig, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let org
  try { org = await resolveOrgBySlug(slug) }
  catch { return NextResponse.json({ error: 'org not found' }, { status: 404 }) }

  try { await guardOrganization(org.id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) return NextResponse.json({ skipped: 'license_disabled' }, { status: 503 })
    throw e
  }

  const evt = JSON.parse(body) as { triggerEvent?: string; payload?: { attendees?: Array<{ phone?: string; email?: string }>; uid?: string } }
  if (evt.triggerEvent === 'BOOKING_CREATED' && evt.payload) {
    const phone = evt.payload.attendees?.[0]?.phone
    if (phone) {
      const db = createServiceSupabase()
      await db.from('incoming_leads').update({
        agent_status: 'BOOKED',
      }).eq('phone_e164', phone).eq('organization_id', org.id)
      await emitAudit({
        organizationId: org.id, action: 'cal.booking_created',
        payload: { phone, booking_uid: evt.payload.uid },
      })
    }
  }
  return NextResponse.json({ ok: true })
}
