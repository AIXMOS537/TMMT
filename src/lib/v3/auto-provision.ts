/**
 * v3 student-operator auto-provision — no human in the loop.
 * Queued team_onboarding rows → Supabase auth user + affiliate code + magic link.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export type OnboardingRow = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  role: string
}

export type ProvisionResult = {
  ok: boolean
  onboardingId: string
  email?: string
  affiliateCode?: string
  authUserId?: string
  magicLinkSent?: boolean
  error?: string
}

const LOGIN_REDIRECT =
  process.env.PROVISION_LOGIN_URL?.replace(/\/login$/, '/operator/training') ??
  'https://tmmt-command-center.vercel.app/operator/training'

export const MAX_TMMT_OPERATORS = Number(process.env.TMMT_MAX_OPERATORS ?? 100)

export async function countActiveOperators(): Promise<number> {
  const db = adminClient()
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return (users?.users ?? []).filter((u) => u.app_metadata?.role === 'operator').length
}

export async function isOperatorCapReached(): Promise<boolean> {
  return (await countActiveOperators()) >= MAX_TMMT_OPERATORS
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function generateAffiliateCode(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? 'OP'
  const prefix = first.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'OP'
  const suffix = randomBytes(2).toString('hex').toUpperCase().slice(0, 2)
  return `${prefix}${suffix}`
}

export function resolveOperatorEmail(row: OnboardingRow): string {
  const email = row.email?.trim()
  if (email && email.includes('@')) return email.toLowerCase()
  const digits = (row.phone ?? '').replace(/\D/g, '')
  if (digits.length >= 10) return `op+${digits}@operators.tmmtrentals.net`
  return `op+${randomBytes(4).toString('hex')}@operators.tmmtrentals.net`
}

function randomPassword(): string {
  return randomBytes(18).toString('base64url')
}

export async function provisionOperatorFromOnboarding(
  row: OnboardingRow,
): Promise<ProvisionResult> {
  if (await isOperatorCapReached()) {
    const db = adminClient()
    await db
      .from('team_onboarding')
      .update({ status: 'Waitlist — cap reached', provision_error: `Max ${MAX_TMMT_OPERATORS} operators` })
      .eq('id', row.id)
    return {
      ok: false,
      onboardingId: row.id,
      error: `TMMT operator network is full (${MAX_TMMT_OPERATORS} lifetime cap). You are on the waitlist.`,
    }
  }

  const db = adminClient()
  const email = resolveOperatorEmail(row)
  const affiliateCode = generateAffiliateCode(row.full_name)
  const password = randomPassword()

  const { data: existingUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email)
  let authUserId = existing?.id

  if (!authUserId) {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'operator', affiliate_code: affiliateCode },
      user_metadata: { full_name: row.full_name, phone: row.phone },
    })
    if (createErr) {
      return { ok: false, onboardingId: row.id, error: createErr.message }
    }
    authUserId = created.user.id
  } else {
    await db.auth.admin.updateUserById(authUserId, {
      app_metadata: { role: 'operator', affiliate_code: affiliateCode },
      user_metadata: { full_name: row.full_name, phone: row.phone },
    })
  }

  await db.from('profiles').upsert({
    id: authUserId,
    full_name: row.full_name,
    email,
    phone: row.phone,
    role: 'operator',
    affiliate_code: affiliateCode,
    unlock_status: 'IN PROGRAM',
    updated_at: new Date().toISOString(),
  })

  const { error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: LOGIN_REDIRECT },
  })

  await db
    .from('team_onboarding')
    .update({
      status: 'Provisioned',
      affiliate_code: affiliateCode,
      auth_user_id: authUserId,
      provisioned_at: new Date().toISOString(),
      provision_error: linkErr?.message ?? null,
    })
    .eq('id', row.id)

  return {
    ok: true,
    onboardingId: row.id,
    email,
    affiliateCode,
    authUserId,
    magicLinkSent: !linkErr,
    error: linkErr?.message,
  }
}

export async function processQueuedOnboardings(limit = 10): Promise<ProvisionResult[]> {
  const db = adminClient()
  const { data: rows, error } = await db
    .from('team_onboarding')
    .select('id, full_name, phone, email, role')
    .in('status', ['Queued', 'Pending Review'])
    .eq('role', 'operator')
    .is('provisioned_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!rows?.length) return []

  const results: ProvisionResult[] = []
  for (const row of rows) {
    results.push(await provisionOperatorFromOnboarding(row as OnboardingRow))
  }
  return results
}

export function isV3AutoProvisionEnabled(): boolean {
  return process.env.V3_AUTO_PROVISION_OPERATORS === 'true'
}
