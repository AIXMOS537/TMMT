/**
 * POST /api/agent/stripe/webhook/[slug]
 * Per-tenant Stripe webhook. Verifies the signature with that tenant's webhook secret
 * (env `STRIPE_WEBHOOK_SECRET_<SLUG>`), THEN looks up the org by partner_app_slug,
 * advances lead state on payment_intent.succeeded.
 *
 * Order of guards (T-02b, T-02c):
 *   header present → secret configured → SIGNATURE → org → licence → REPLAY GATE → write.
 * The signature check is pure CPU on env-held material, so an unsigned caller
 * never reaches the database and cannot tell an unknown slug (404) from a bad
 * signature (401): both are 401 until the caller proves it holds the secret.
 * A slug with no secret configured answers that same 401 (T-02c) — it used to
 * be a 500 that let a probe map which slugs are wired — and the
 * misconfiguration is logged server-side (`resolveTenantWebhookSecret`).
 */
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { resolveOrgBySlug } from '@/lib/agent/tenant'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { guardOrganization, LicenseDisabledError } from '@/lib/agent/guard'
import { emitAudit } from '@/lib/agent/audit'
import { seenWebhookEvent } from '@/lib/agent/webhook-replay'
import { resolveTenantWebhookSecret } from '@/lib/agent/tenant-webhook-secret'

const unauthorized = () => NextResponse.json({ error: 'invalid signature' }, { status: 401 })

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const { slug } = await params
  const sig = req.headers.get('stripe-signature') ?? ''
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 })

  const secret = resolveTenantWebhookSecret('agent/stripe/webhook', 'STRIPE_WEBHOOK_SECRET', slug)
  if (!secret) return unauthorized()

  const body = await req.text()
  const stripe = new Stripe('sk_placeholder_construct_event_only')
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(body, sig, secret) }
  catch (e) {
    // constructEvent verifies the header first and only then JSON.parses the
    // body, so a SyntaxError here means the caller proved it holds the secret
    // and sent something that is not JSON: a malformed request, not a forgery.
    if (e instanceof SyntaxError) return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    return unauthorized()
  }

  // Signature verified: only now touch the database.
  let org
  try { org = await resolveOrgBySlug(slug) }
  catch { return NextResponse.json({ error: 'org not found' }, { status: 404 }) }

  try { await guardOrganization(org.id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) return NextResponse.json({ skipped: 'license_disabled' }, { status: 503 })
    throw e
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const db = createServiceRoleClient()

    // ── REPLAY GATE ────────────────────────────────────────────────────────
    // Stripe retries re-deliver the same event.id inside the signature
    // tolerance window. The audit row written below carries that id; look it
    // up before the lead update so a retry is a 200 no-op with no second
    // write and no second audit row. See src/lib/agent/webhook-replay.ts.
    if (await seenWebhookEvent(db, {
      organizationId: org.id, action: 'stripe.payment_collected', keyField: 'event_id', key: event.id,
    })) {
      console.warn('[agent/stripe/webhook] duplicate event id, dropping replay')
      return NextResponse.json({ ok: true, duplicate: true })
    }

    await db.from('incoming_leads').update({
      agent_status: 'CLOSED',
      closed_at: new Date().toISOString(),
    }).eq('stripe_payment_intent_id', pi.id).eq('organization_id', org.id)
    await emitAudit({
      organizationId: org.id,
      action: 'stripe.payment_collected',
      payload: { event_id: event.id, payment_intent_id: pi.id, amount: pi.amount, currency: pi.currency },
    })
  }
  return NextResponse.json({ ok: true })
}
