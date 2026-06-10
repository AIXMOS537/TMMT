/**
 * POST /api/audit/events
 * Accepts NDJSON lines OR a single JSON event. Append-only audit ingest.
 * Auth: X-Audit-Key header (rotates independently of license/admin keys).
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceSupabase } from '@/lib/agent/supabase-server'

const MAX_BYTES = 1_000_000
const MAX_LINES = 10_000

function authorized(req: Request): boolean {
  const provided = req.headers.get('x-audit-key') ?? ''
  const expected = process.env.AUDIT_INGEST_KEY ?? ''
  if (!provided || !expected || provided.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(provided), Buffer.from(expected)) }
  catch { return false }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const text = await req.text()
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'payload too large' }, { status: 413 })

  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
  if (lines.length > MAX_LINES) return NextResponse.json({ error: 'too many events' }, { status: 413 })

  const rows = lines.map((line) => {
    const evt = JSON.parse(line)
    return {
      ts: evt.ts ?? new Date().toISOString(),
      organization_id: evt.organization_id ?? null,
      hardware_uuid: evt.hardware_uuid ?? null,
      ip: req.headers.get('x-forwarded-for') ?? null,
      action: evt.action ?? 'unknown',
      payload: evt.payload ?? {},
    }
  })

  const db = createServiceSupabase()
  const { error } = await db.from('audit_events').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accepted: rows.length }, { status: 202 })
}
