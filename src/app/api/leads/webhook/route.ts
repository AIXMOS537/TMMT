/**
 * POST /api/leads/webhook
 * Public form endpoint for landing pages (phone-only forms).
 * Creates an incoming_leads row scoped to organization (resolved by ?org=<slug> query).
 * Emits lead_received audit event; downstream realtime subscriber triggers first outbound SMS.
 */
import { NextResponse } from 'next/server'
import { resolveOrgBySlugPublic, resolveOrgById, OrgNotFoundError } from '@/lib/agent/tenant'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
import { guardOrganization, LicenseDisabledError } from '@/lib/agent/guard'
import { emitAudit } from '@/lib/agent/audit'
import { triggerFirstOutbound } from '@/lib/agent/lead-outbound'
import { isRateLimited } from '@/lib/rate-limit'

const SKU_PRICE_CENTS: Record<string, number> = {
  'lead-magnet': 0,
  'intro-97': 9700,
  'training': 700000,
  'rental-in-a-box': 1500000,
  'flagship': 5000000,
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

interface WebhookBody {
  phone: string
  sku?: string
  email?: string
  name?: string
  source?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  landing_url?: string
  referrer_url?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const slug = url.searchParams.get('org') ?? ''
  if (!slug) return NextResponse.json({ error: 'org query param required' }, { status: 400 })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(`leads:${slug}:${ip}`, { windowMs: 60_000, maxHits: 3 })) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 })
  }
  if (isRateLimited(`leads:ip:${ip}`, { windowMs: 60_000, maxHits: 10 })) {
    return NextResponse.json({ error: 'too many requests' }, { status: 429 })
  }

  let orgPublic
  try { orgPublic = await resolveOrgBySlugPublic(slug) }
  catch (e) {
    if (e instanceof OrgNotFoundError) return NextResponse.json({ error: 'org not found' }, { status: 404 })
    throw e
  }

  try { await guardOrganization(orgPublic.id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) {
      return NextResponse.json({ error: 'service temporarily unavailable' }, { status: 503 })
    }
    throw e
  }

  let body: WebhookBody
  try { body = (await req.json()) as WebhookBody }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const phone_e164 = normalizePhone(body.phone || '')
  if (!phone_e164) return NextResponse.json({ error: 'invalid phone' }, { status: 400 })

  const sku = body.sku || 'lead-magnet'
  const sku_price_cents = SKU_PRICE_CENTS[sku] ?? 0

  const db = createServiceSupabase()
  const { data: existing } = await db.from('incoming_leads')
    .select('id, agent_status')
    .eq('phone_e164', phone_e164)
    .eq('organization_id', orgPublic.id)
    .maybeSingle()

  let leadId: string
  if (existing) {
    leadId = existing.id
    await db.from('incoming_leads').update({
      sku, sku_price_cents,
      email: body.email ?? null,
      contact_name: body.name ?? null,
      source: body.source ?? 'webform',
      source_campaign: body.utm_campaign ?? null,
      source_medium: body.utm_medium ?? null,
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
      utm_content: body.utm_content ?? null,
      utm_term: body.utm_term ?? null,
      landing_url: body.landing_url ?? null,
      referrer_url: body.referrer_url ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', leadId)
  } else {
    const ins = await db.from('incoming_leads').insert({
      organization_id: orgPublic.id,
      phone_e164,
      email: body.email ?? null,
      contact_name: body.name ?? null,
      sku, sku_price_cents,
      agent_status: 'NEW',
      source: body.source ?? 'webform',
      source_campaign: body.utm_campaign ?? null,
      source_medium: body.utm_medium ?? null,
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
      utm_content: body.utm_content ?? null,
      utm_term: body.utm_term ?? null,
      landing_url: body.landing_url ?? null,
      referrer_url: body.referrer_url ?? null,
    }).select('id').single()
    leadId = ins.data!.id
  }

  await emitAudit({
    organizationId: orgPublic.id,
    action: 'lead.received',
    ip: req.headers.get('x-forwarded-for') ?? null,
    payload: { lead_id: leadId, sku, phone_e164, utm_source: body.utm_source, utm_campaign: body.utm_campaign },
  })

  const org = await resolveOrgById(orgPublic.id)
  const outbound = await triggerFirstOutbound({
    org,
    leadId,
    phoneE164: phone_e164,
    contactName: body.name ?? null,
    sku,
    skuPriceCents: sku_price_cents,
    ip: req.headers.get('x-forwarded-for') ?? null,
  })

  return NextResponse.json({ ok: true, lead_id: leadId, sent: outbound.sent, outbound_reason: outbound.reason ?? null })
}
