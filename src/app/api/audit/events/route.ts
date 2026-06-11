/**
 * POST /api/audit/events
 * Accepts NDJSON lines OR a single JSON event. Append-only audit ingest.
 * Auth: X-Audit-Key header (rotates independently of license/admin keys).
 *
 * Per Layer-2 audit:
 * - Per-line try/catch so one malformed NDJSON line does not drop the whole
 *   batch (prior implementation threw → 500 → audit drop)
 * - Action allowlist (prefix-checked) so a compromised key cannot inject
 *   arbitrary action names that downstream tooling may render or trust
 * - Per-event payload size cap so audit rows cannot be ballooned with
 *   stored-XSS / stored-prompt-injection payloads
 * - 500s log internally but do not echo Supabase error.message to the caller
 *   (schema details leak)
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceSupabase } from '@/lib/agent/supabase-server'

const MAX_BYTES = 1_000_000
const MAX_LINES = 10_000
const MAX_PAYLOAD_BYTES = 16_000

// Action namespace allowlist. Events must START with one of these prefixes.
// Keeps the audit log discoverable and prevents a compromised partner key
// from injecting events that impersonate other systems (e.g. a partner ingest
// key writing `action: 'license.restored'` against another org).
const ACTION_PREFIXES = [
  'license.',
  'agent.',
  'compliance.',
  'partner.',
  'lead.',
  'cron.',
]

function authorized(req: Request): boolean {
  const provided = req.headers.get('x-audit-key') ?? ''
  const expected = process.env.AUDIT_INGEST_KEY ?? ''
  if (!provided || !expected || provided.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(provided), Buffer.from(expected)) }
  catch { return false }
}

function validAction(action: unknown): action is string {
  if (typeof action !== 'string' || action.length === 0 || action.length > 100) return false
  return ACTION_PREFIXES.some((p) => action.startsWith(p))
}

function safePayload(p: unknown): Record<string, unknown> | null {
  if (p === null || p === undefined) return {}
  if (typeof p !== 'object' || Array.isArray(p)) return null
  try {
    const json = JSON.stringify(p)
    if (json.length > MAX_PAYLOAD_BYTES) return null
    return p as Record<string, unknown>
  } catch {
    return null
  }
}

interface RawEvent {
  ts?: unknown
  organization_id?: unknown
  hardware_uuid?: unknown
  action?: unknown
  payload?: unknown
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const text = await req.text()
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'payload too large' }, { status: 413 })

  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
  if (lines.length > MAX_LINES) return NextResponse.json({ error: 'too many events' }, { status: 413 })

  const ip = req.headers.get('x-forwarded-for') ?? null
  const rows: Array<Record<string, unknown>> = []
  let skipped = 0
  const skipReasons: Record<string, number> = {}

  for (const line of lines) {
    let evt: RawEvent
    try { evt = JSON.parse(line) as RawEvent }
    catch {
      skipped++
      skipReasons.invalid_json = (skipReasons.invalid_json ?? 0) + 1
      continue
    }

    if (!validAction(evt.action)) {
      skipped++
      skipReasons.invalid_action = (skipReasons.invalid_action ?? 0) + 1
      continue
    }
    const payload = safePayload(evt.payload)
    if (payload === null) {
      skipped++
      skipReasons.invalid_payload = (skipReasons.invalid_payload ?? 0) + 1
      continue
    }

    rows.push({
      ts: typeof evt.ts === 'string' ? evt.ts : new Date().toISOString(),
      organization_id: typeof evt.organization_id === 'string' ? evt.organization_id : null,
      hardware_uuid: typeof evt.hardware_uuid === 'string' ? evt.hardware_uuid : null,
      ip,
      action: evt.action as string,
      payload,
    })
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { accepted: 0, skipped, skip_reasons: skipReasons },
      { status: 202 },
    )
  }

  const db = createServiceSupabase()
  const { error } = await db.from('audit_events').insert(rows)
  if (error) {
    console.error('[audit/events] insert failed', error.message)
    return NextResponse.json({ error: 'insert failed' }, { status: 500 })
  }
  return NextResponse.json(
    { accepted: rows.length, skipped, skip_reasons: skipReasons },
    { status: 202 },
  )
}
