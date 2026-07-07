/**
 * GET /api/operator/earnings
 * Student-operator commission rollup for their affiliate code only.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSSRClient } from '@/lib/supabase-server'
import { rollupAffiliates, type PaymentRow } from '@/lib/affiliates'

export const dynamic = 'force-dynamic'

// `||` not `??`: an empty-string env var must still fall back, or share links
// render as relative paths that break when copied out of the app.
const SHARE_BASE = process.env.NEXT_PUBLIC_OPS_URL || 'https://tmmt-ops.vercel.app'

export async function GET(): Promise<NextResponse> {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = user.app_metadata?.role
  if (role !== 'operator') {
    return NextResponse.json({ error: 'Operators only' }, { status: 403 })
  }

  const code = String(user.app_metadata?.affiliate_code ?? '').trim()
  if (!code) {
    return NextResponse.json({
      affiliateCode: null,
      commission: 0,
      grossCollected: 0,
      paidSales: 0,
      pendingSales: 0,
      shareLinks: [],
      message: 'No affiliate code assigned yet. Complete onboarding first.',
    })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: payments, error } = await admin
    .from('customer_payments')
    .select('amount, payment_status, notes, created_at')
    .ilike('notes', `%aff: ${code}%`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rollup = rollupAffiliates((payments ?? []) as PaymentRow[])
  const mine = rollup.find((r) => r.code.toUpperCase() === code.toUpperCase())

  const ref = encodeURIComponent(code)
  const shareLinks = [
    { label: 'Free playbook (lead magnet)', url: `${SHARE_BASE}/lp/aixmos/lead-magnet?ref=${ref}` },
    { label: '$97 credit audit', url: `${SHARE_BASE}/lp/aixmos/intro-97?ref=${ref}` },
    { label: 'Operator Academy', url: `${SHARE_BASE}/lp/aixmos/training?ref=${ref}` },
    { label: 'Lead intake form', url: `${SHARE_BASE}/forms/lead-intake?ref=${ref}` },
    { label: 'Join TMMT (recruit)', url: `${SHARE_BASE}/join?ref=${ref}` },
  ]

  return NextResponse.json({
    affiliateCode: code,
    commission: mine?.commission ?? 0,
    grossCollected: mine?.grossCollected ?? 0,
    paidSales: mine?.paidSales ?? 0,
    pendingSales: mine?.pendingSales ?? 0,
    commissionRate: 0.3,
    payoutNote: 'Commissions paid monthly on collected revenue.',
    shareLinks,
  })
}
