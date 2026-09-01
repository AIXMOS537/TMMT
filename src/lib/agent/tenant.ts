import { z } from 'zod'
import { createServiceSupabase } from './supabase-server'

export interface OrgContext {
  id: string
  name: string
  partnerAppSlug: string | null
  agentName: string
  tenantBrand: string
  agentPersonaOverlay: Record<string, unknown>
  handoffSlackWebhook: string | null
  handoffImessageTarget: string | null
  calComEventLink: string | null
  stripeConnectAccountId: string | null
  llmDailyCapUsd: number
  twilioInboundNumber: string | null
}

/**
 * Subset of OrgContext that is safe to expose to unauthenticated callers
 * (e.g. landing-page lead webhook). Excludes credentials, handoff webhooks,
 * connected-account IDs, and any field that leaks operational topology.
 */
export interface PublicOrgContext {
  id: string
  name: string
  partnerAppSlug: string | null
  agentName: string
  tenantBrand: string
}

export class OrgNotFoundError extends Error {
  constructor(public lookup: string) {
    super(`No organization for ${lookup}`)
    this.name = 'OrgNotFoundError'
  }
}

export class OrgRowShapeError extends Error {
  constructor(public lookup: string, public zodIssues: string) {
    super(`Org row failed schema validation for ${lookup}: ${zodIssues}`)
    this.name = 'OrgRowShapeError'
  }
}

const COLUMNS_FULL =
  'id, name, partner_app_slug, agent_name, agent_persona_overlay, handoff_slack_webhook, handoff_imessage_target, cal_com_event_link, stripe_connect_account_id, llm_daily_cap_usd, twilio_inbound_number'

const COLUMNS_PUBLIC = 'id, name, partner_app_slug, agent_name'

// Zod 4's .uuid() enforces the RFC 9562 version and variant nibbles. The AIXMOS org
// was seeded with a placeholder id - aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa - which is
// the right shape but carries no version digit, so .uuid() rejects it: every lead for
// that org 500s out of resolveOrgBySlugPublic, because OrgRowShapeError is not one of
// the errors the webhook route catches. Zod 3 accepted it, which is why this only
// broke on the upgrade. Keep the shape check, drop the version demand.
//
// This guards two different kinds of value, so do not read it as an authorization
// boundary. Here it checks rows coming back from Postgres. In dispatch/actions.ts it
// also checks an org_id posted by the client - and there, access is decided by the
// requireOrgAccess() call that follows every parse, never by whether the id is
// well formed. Widening the shape does not widen what anyone can reach.
export const OrgIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid organization id')

const OrgRowSchema = z.object({
  id: OrgIdSchema,
  name: z.string().min(1),
  partner_app_slug: z.string().nullable(),
  agent_name: z.string().nullable(),
  agent_persona_overlay: z.record(z.string(), z.unknown()).nullable(),
  handoff_slack_webhook: z.string().nullable(),
  handoff_imessage_target: z.string().nullable(),
  cal_com_event_link: z.string().nullable(),
  stripe_connect_account_id: z.string().nullable(),
  llm_daily_cap_usd: z.union([z.number(), z.string()]).nullable(),
  twilio_inbound_number: z.string().nullable(),
})

const PublicOrgRowSchema = z.object({
  id: OrgIdSchema,
  name: z.string().min(1),
  partner_app_slug: z.string().nullable(),
  agent_name: z.string().nullable(),
})

function rowToCtx(row: unknown, lookup: string): OrgContext {
  const parsed = OrgRowSchema.safeParse(row)
  if (!parsed.success) throw new OrgRowShapeError(lookup, parsed.error.message)
  const r = parsed.data
  return {
    id: r.id,
    name: r.name,
    partnerAppSlug: r.partner_app_slug,
    agentName: r.agent_name ?? 'Riley',
    tenantBrand: r.name,
    agentPersonaOverlay: (r.agent_persona_overlay ?? {}) as Record<string, unknown>,
    handoffSlackWebhook: r.handoff_slack_webhook,
    handoffImessageTarget: r.handoff_imessage_target,
    calComEventLink: r.cal_com_event_link,
    stripeConnectAccountId: r.stripe_connect_account_id,
    llmDailyCapUsd: Number(r.llm_daily_cap_usd ?? 50),
    twilioInboundNumber: r.twilio_inbound_number,
  }
}

function rowToPublicCtx(row: unknown, lookup: string): PublicOrgContext {
  const parsed = PublicOrgRowSchema.safeParse(row)
  if (!parsed.success) throw new OrgRowShapeError(lookup, parsed.error.message)
  const r = parsed.data
  return {
    id: r.id,
    name: r.name,
    partnerAppSlug: r.partner_app_slug,
    agentName: r.agent_name ?? 'Riley',
    tenantBrand: r.name,
  }
}

export async function resolveOrgByTwilioNumber(number: string): Promise<OrgContext> {
  const db = createServiceSupabase()
  const { data } = await db.from('organizations').select(COLUMNS_FULL).eq('twilio_inbound_number', number).single()
  if (!data) throw new OrgNotFoundError(`twilio:${number}`)
  return rowToCtx(data, `twilio:${number}`)
}

export async function resolveOrgById(id: string): Promise<OrgContext> {
  const db = createServiceSupabase()
  const { data } = await db.from('organizations').select(COLUMNS_FULL).eq('id', id).single()
  if (!data) throw new OrgNotFoundError(`id:${id}`)
  return rowToCtx(data, `id:${id}`)
}

export async function resolveOrgBySlug(slug: string): Promise<OrgContext> {
  const db = createServiceSupabase()
  const { data } = await db.from('organizations').select(COLUMNS_FULL).eq('partner_app_slug', slug).single()
  if (!data) throw new OrgNotFoundError(`slug:${slug}`)
  return rowToCtx(data, `slug:${slug}`)
}

/**
 * Public-safe variant for unauthenticated callers (landing page lead webhook).
 * Returns ONLY id + display-safe metadata — no credentials, no webhooks, no
 * connected-account IDs. Use this instead of resolveOrgBySlug from any route
 * that does not gate the caller with a tenant-bound credential.
 */
export async function resolveOrgBySlugPublic(slug: string): Promise<PublicOrgContext> {
  const db = createServiceSupabase()
  const { data } = await db.from('organizations').select(COLUMNS_PUBLIC).eq('partner_app_slug', slug).single()
  if (!data) throw new OrgNotFoundError(`slug:${slug}`)
  return rowToPublicCtx(data, `slug:${slug}`)
}
