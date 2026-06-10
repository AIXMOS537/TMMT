/**
 * POST /api/agent/stripe/webhook/[slug]
 * Per-tenant Stripe webhook. Looks up org by partner_app_slug, verifies signature with that tenant's
 * webhook secret, advances lead state on payment_intent.succeeded.
 */
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { resolveOrgBySlug } from '@/lib/agent/tenant'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
import { guardOrganization, LicenseDisabledError } from '@/lib/agent/guard'
import { emitAudit } from '@/lib/agent/audit'

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const { slug } = await params
  const sig = req.headers.get('stripe-signature') ?? ''
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 })

  let org
  try { org = await resolveOrgBySlug(slug) }
  catch { return NextResponse.json({ error: 'org not found' }, { status: 404 }) }

  const secretEnvKey = `STRIPE_WEBHOOK_SECRET_${slug.toUpperCase().replace(/-/g, '_')}`
  const secret = process.env[secretEnvKey]
  if (!secret) return NextResponse.json({ error: `webhook secret ${secretEnvKey} not configured` }, { status: 500 })

  const body = await req.text()
  const stripe = new Stripe('sk_placeholder_construct_event_only')
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(body, sig, secret) }
  catch { return NextResponse.json({ error: 'invalid signature' }, { status: 401 }) }

  try { await guardOrganization(org.id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) return NextResponse.json({ skipped: 'license_disabled' }, { status: 503 })
    throw e
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const db = createServiceSupabase()
    await db.from('incoming_leads').update({
      agent_status: 'CLOSED',
      closed_at: new Date().toISOString(),
    }).eq('stripe_payment_intent_id', pi.id).eq('organization_id', org.id)
    await emitAudit({
      organizationId: org.id,
      action: 'stripe.payment_collected',
      payload: { payment_intent_id: pi.id, amount: pi.amount, currency: pi.currency },
    })
  }
  return NextResponse.json({ ok: true })
}
