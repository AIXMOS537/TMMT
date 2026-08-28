/**
 * POST /api/leads/webhook
 * Public form endpoint for landing pages (phone-only forms).
 * Creates an incoming_leads row scoped to organization (resolved by ?org=<slug> query).
 * Emits lead_received audit event; downstream realtime subscriber triggers first outbound SMS.
 */
import { NextResponse } from 'next/server'
import { resolveOrgBySlugPublic, OrgNotFoundError } from '@/lib/agent/tenant'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
import { guardOrganization, LicenseDisabledError } from '@/lib/agent/guard'
import { emitAudit } from '@/lib/agent/audit'
import { isRateLimited } from '@/lib/rate-limit'
import { routeIncomingLead } from '@/lib/lead-pool'
import { isAixmosCorsOrigin } from '@/lib/site-domains'
import { enqueueDoorRoute } from '@/lib/intake/door-router'

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): NextResponse {
  const res = NextResponse.json(body, { status })
  if (origin && isAixmosCorsOrigin(origin)) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v)
  }
  return res
}

export async function OPTIONS(req: Request): Promise<NextResponse> {
  const origin = req.headers.get('origin')
  if (!isAixmosCorsOrigin(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin!) })
}

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
  const origin = req.headers.get('origin')
  const fail = (body: unknown, status: number) => json(body, status, origin)

  const url = new URL(req.url)
  const slug = url.searchParams.get('org') ?? ''
  if (!slug) return fail({ error: 'org query param required' }, 400)

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(`leads:${slug}:${ip}`, { windowMs: 60_000, maxHits: 3 })) {
    return fail({ error: 'too many requests' }, 429)
  }
  if (isRateLimited(`leads:ip:${ip}`, { windowMs: 60_000, maxHits: 10 })) {
    return fail({ error: 'too many requests' }, 429)
  }

  let org
  try { org = await resolveOrgBySlugPublic(slug) }
  catch (e) {
    if (e instanceof OrgNotFoundError) return fail({ error: 'org not found' }, 404)
    throw e
  }

  try { await guardOrganization(org.id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) {
      return fail({ error: 'service temporarily unavailable' }, 503)
    }
    throw e
  }

  let body: WebhookBody
  try { body = (await req.json()) as WebhookBody }
  catch { return fail({ error: 'invalid json' }, 400) }

  const phone_e164 = normalizePhone(body.phone || '')
  if (!phone_e164) return fail({ error: 'invalid phone' }, 400)

  const sku = body.sku || 'lead-magnet'
  const sku_price_cents = SKU_PRICE_CENTS[sku] ?? 0

  const db = createServiceSupabase()
  const { data: existing } = await db.from('incoming_leads')
    .select('id, agent_status')
    .eq('phone_e164', phone_e164)
    .eq('organization_id', org.id)
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
      organization_id: org.id,
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
    organizationId: org.id,
    action: 'lead.received',
    ip: req.headers.get('x-forwarded-for') ?? null,
    payload: { lead_id: leadId, sku, phone_e164, utm_source: body.utm_source, utm_campaign: body.utm_campaign },
  })

  // Capture → shared lead pool (fail-open: never blocks intake; no-ops until the
  // lead_pool migration is applied + routes exist). See src/lib/lead-pool.ts.
  try {
    await routeIncomingLead(db, {
      leadId,
      capturingOrgId: org.id,
      utmCampaign: body.utm_campaign ?? null,
      utmSource: body.utm_source ?? null,
      signals: [body.source, body.utm_medium, body.utm_content, body.utm_term, sku],
    })
  } catch { /* fail-open — lead is already saved + audited */ }

  enqueueDoorRoute({
    sku,
    orgSlug: slug,
    name: body.name ?? "Unknown",
    email: body.email,
    phone: phone_e164,
    opportunityName: sku,
    source: body.source ?? "webform",
  })

  return json({ ok: true, lead_id: leadId }, 200, origin)
}
