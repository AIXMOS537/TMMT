/**
 * GET|POST /api/cron/auto-provision-operators
 * Processes queued student-operator applications without human review.
 * Auth: Bearer CRON_SECRET (or OPS_COMMAND_SECRET).
 * GET exists because Vercel cron invokes with GET (it sends the same
 * Authorization: Bearer CRON_SECRET header).
 */
import { NextResponse } from 'next/server'
import { processQueuedOnboardings } from '@/lib/v3/auto-provision'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.OPS_COMMAND_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env.V3_AUTO_PROVISION_OPERATORS !== 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'V3_AUTO_PROVISION_OPERATORS is not true',
    })
  }

  try {
    const results = await processQueuedOnboardings(10)
    const ok = results.filter((r) => r.ok)
    const failed = results.filter((r) => !r.ok)
    return NextResponse.json({
      processed: results.length,
      provisioned: ok.length,
      failed: failed.length,
      results,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
