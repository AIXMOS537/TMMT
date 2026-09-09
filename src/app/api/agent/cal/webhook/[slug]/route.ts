/**
 * POST /api/agent/cal/webhook/[slug]
 * Per-tenant Cal.com webhook. Verifies HMAC-SHA256 signature, advances lead state on BOOKING_CREATED.
 *
 * Order of guards (T-02b, T-02c):
 *   secret configured → SIGNATURE → parse → org → licence → REPLAY GATE → write.
 * Cal.com's signature carries no timestamp and no nonce, so verification alone
 * cannot reject a captured request; the replay gate on the booking uid does.
 * A slug with no secret configured answers the same 401 as a bad signature
 * (T-02c; was a 500 that let a probe map which slugs are wired) and the
 * misconfiguration is logged server-side (`resolveTenantWebhookSecret`).
 */
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { resolveOrgBySlug } from '@/lib/agent/tenant'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { guardOrganization, LicenseDisabledError } from '@/lib/agent/guard'
import { emitAudit } from '@/lib/agent/audit'
import { seenWebhookEvent } from '@/lib/agent/webhook-replay'
import { resolveTenantWebhookSecret } from '@/lib/agent/tenant-webhook-secret'

const unauthorized = () => NextResponse.json({ error: 'invalid signature' }, { status: 401 })

type CalEvent = {
  triggerEvent?: unknown
  payload?: { attendees?: Array<{ phone?: unknown; email?: unknown }>; uid?: unknown }
}

function verifyCalSignature(body: string, sig: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    if (sig.length !== expected.length) return false
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch { return false }
}

/** JSON object or null. Arrays, scalars and unparseable text are all "not a Cal event". */
function parseCalEvent(body: string): CalEvent | null {
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed as CalEvent
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const { slug } = await params
  const sig = req.headers.get('x-cal-signature-256') ?? ''
  const secret = resolveTenantWebhookSecret('agent/cal/webhook', 'CAL_WEBHOOK_SECRET', slug)
  if (!secret) return unauthorized()

  const body = await req.text()
  if (!verifyCalSignature(body, sig, secret)) return unauthorized()

  // Signed but not JSON is a malformed request from someone who holds the
  // secret, not a forgery: 400, and nothing is looked up for it.
  const evt = parseCalEvent(body)
  if (!evt) return NextResponse.json({ error: 'invalid json' }, { status: 400 })

  let org
  try { org = await resolveOrgBySlug(slug) }
  catch { return NextResponse.json({ error: 'org not found' }, { status: 404 }) }

  try { await guardOrganization(org.id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) return NextResponse.json({ skipped: 'license_disabled' }, { status: 503 })
    throw e
  }

  if (evt.triggerEvent === 'BOOKING_CREATED' && evt.payload) {
    const rawPhone = evt.payload.attendees?.[0]?.phone
    const phone = typeof rawPhone === 'string' && rawPhone ? rawPhone : null
    const rawUid = evt.payload.uid
    const uid = typeof rawUid === 'string' && rawUid ? rawUid : null
    if (phone) {
      const db = createServiceRoleClient()

      // ── REPLAY GATE ──────────────────────────────────────────────────────
      // Keyed on the booking uid: Cal.com issues one BOOKING_CREATED per uid,
      // and the audit action already encodes the trigger, so the same uid
      // arriving as a different trigger (RESCHEDULED, CANCELLED) is a
      // different key. A payload with no uid has nothing to dedupe on and is
      // processed as before. See src/lib/agent/webhook-replay.ts.
      if (uid && await seenWebhookEvent(db, {
        organizationId: org.id, action: 'cal.booking_created', keyField: 'booking_uid', key: uid,
      })) {
        console.warn('[agent/cal/webhook] duplicate booking uid, dropping replay')
        return NextResponse.json({ ok: true, duplicate: true })
      }

      await db.from('incoming_leads').update({
        agent_status: 'BOOKED',
      }).eq('phone_e164', phone).eq('organization_id', org.id)
      await emitAudit({
        organizationId: org.id, action: 'cal.booking_created',
        payload: { phone, booking_uid: uid ?? undefined },
      })
    }
  }
  return NextResponse.json({ ok: true })
}
