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

export class OrgNotFoundError extends Error {
  constructor(public lookup: string) { super(`No organization for ${lookup}`); this.name = 'OrgNotFoundError' }
}

const COLUMNS = 'id, name, partner_app_slug, agent_name, agent_persona_overlay, handoff_slack_webhook, handoff_imessage_target, cal_com_event_link, stripe_connect_account_id, llm_daily_cap_usd, twilio_inbound_number'

function rowToCtx(row: any): OrgContext {
  return {
    id: row.id,
    name: row.name,
    partnerAppSlug: row.partner_app_slug,
    agentName: row.agent_name ?? 'Riley',
    tenantBrand: row.name,
    agentPersonaOverlay: row.agent_persona_overlay ?? {},
    handoffSlackWebhook: row.handoff_slack_webhook,
    handoffImessageTarget: row.handoff_imessage_target,
    calComEventLink: row.cal_com_event_link,
    stripeConnectAccountId: row.stripe_connect_account_id,
    llmDailyCapUsd: Number(row.llm_daily_cap_usd ?? 50),
    twilioInboundNumber: row.twilio_inbound_number,
  }
}

export async function resolveOrgByTwilioNumber(number: string): Promise<OrgContext> {
  const db = createServiceSupabase()
  const { data } = await db.from('organizations').select(COLUMNS).eq('twilio_inbound_number', number).single()
  if (!data) throw new OrgNotFoundError(`twilio:${number}`)
  return rowToCtx(data)
}

export async function resolveOrgById(id: string): Promise<OrgContext> {
  const db = createServiceSupabase()
  const { data } = await db.from('organizations').select(COLUMNS).eq('id', id).single()
  if (!data) throw new OrgNotFoundError(`id:${id}`)
  return rowToCtx(data)
}

export async function resolveOrgBySlug(slug: string): Promise<OrgContext> {
  const db = createServiceSupabase()
  const { data } = await db.from('organizations').select(COLUMNS).eq('partner_app_slug', slug).single()
  if (!data) throw new OrgNotFoundError(`slug:${slug}`)
  return rowToCtx(data)
}
