import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUDIT_EVENTS_COLUMNS } from './audit-events-columns'

/**
 * C-20: nothing type-checks a query against `audit_events` (no CREATE TABLE in
 * the repo, fake DB in the tests), so this scans the source. Every
 * `.from('audit_events')` chain in src may only name columns in
 * AUDIT_EVENTS_COLUMNS, in `.select(...)`, a filter or `.order(...)`.
 * Insert payloads are not scanned; `emitAudit` and `/api/audit/events` already
 * write the real shape.
 */
const SRC = join(process.cwd(), 'src')
const known = new Set<string>(AUDIT_EVENTS_COLUMNS)

/**
 * Known wrong column references still in the source. Each entry has to still
 * be there, so fixing one fails this test until the entry is removed. Empty
 * since guard.ts was fixed (`assertLlmCapNotExceeded` filtered `created_at`).
 */
const KNOWN_WRONG: Array<{ file: string; column: string }> = []

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : []
  })
}

/** The builder chain after each `.from('audit_events')`, up to the end of the statement. */
function auditChains(text: string): string[] {
  const out: string[] = []
  const re = /\.from\(\s*['"`]audit_events['"`]\s*\)/g
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const rest = text.slice(m.index + m[0].length)
    const end = rest.search(/;|\n\s*\n|\n\s*(?:if|const|let|return|await)\b/)
    out.push(end === -1 ? rest : rest.slice(0, end))
  }
  return out
}

const COLUMN_METHODS = 'eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|not|order|filter|match'
function columnsIn(chain: string): string[] {
  const cols: string[] = []
  for (const [, list] of chain.matchAll(/\.select\(\s*['"`]([^'"`]*)['"`]/g)) {
    cols.push(...list.split(',').map((c) => c.trim()).filter((c) => c && c !== '*'))
  }
  for (const [, col] of chain.matchAll(new RegExp(`\\.(?:${COLUMN_METHODS})\\(\\s*['"\`]([^'"\`$]+)`, 'g'))) {
    cols.push(col.trim())
  }
  // `payload->>booking_uid` is a filter on `payload`.
  return cols.map((c) => c.split('->')[0].trim())
}

function wrongReferences(): Array<{ file: string; column: string }> {
  return sourceFiles(SRC).flatMap((path) => {
    const file = relative(process.cwd(), path).replaceAll('\\', '/')
    return auditChains(readFileSync(path, 'utf8'))
      .flatMap(columnsIn)
      .filter((column) => !known.has(column))
      .map((column) => ({ file, column }))
  })
}

describe('audit_events queries name real columns (C-20)', () => {
  it('finds the audit_events queries it is meant to check', () => {
    const files = sourceFiles(SRC).filter((p) => auditChains(readFileSync(p, 'utf8')).length > 0)
      .map((p) => relative(process.cwd(), p).replaceAll('\\', '/'))
    expect(files).toEqual(expect.arrayContaining(['src/lib/agent/webhook-replay.ts', 'src/lib/agent/guard.ts']))
  })

  it('sees a template-literal payload filter as a payload column', () => {
    expect(columnsIn(".select('ts').eq('organization_id', o).eq(`payload->>${k}`, v).limit(1)"))
      .toEqual(['ts', 'organization_id', 'payload'])
    expect(columnsIn(".select('created_at').order('created_at')")).toEqual(['created_at', 'created_at'])
  })

  it('no query outside the known list names a column audit_events does not have', () => {
    const unexpected = wrongReferences().filter(
      (r) => !KNOWN_WRONG.some((k) => k.file === r.file && k.column === r.column),
    )
    expect(unexpected).toEqual([])
  })

  it('every KNOWN_WRONG entry is still in the source (remove it once fixed)', () => {
    const found = wrongReferences()
    for (const k of KNOWN_WRONG) expect(found).toContainEqual(k)
  })
})
