import { describe, it, expect } from 'vitest'
import { findBannedPhrases } from './banned-phrases'

describe('findBannedPhrases — core list', () => {
  it('flags "guaranteed approval" in normal spelling', () => {
    const hits = findBannedPhrases('We can offer guaranteed approval for everyone')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => h.match.toLowerCase().includes('guaranteed approval'))).toBe(true)
  })

  it('flags "credit repair"', () => {
    const hits = findBannedPhrases('Our credit repair service is the best')
    expect(hits.some((h) => h.match.toLowerCase().includes('credit repair'))).toBe(true)
  })

  it('flags impersonation phrasing', () => {
    const hits = findBannedPhrases("Actually I'm a real person, not a bot")
    expect(hits.length).toBeGreaterThan(0)
  })

  it('returns empty array for clean copy', () => {
    expect(findBannedPhrases('Thanks for reaching out, how can I help?')).toEqual([])
  })
})

describe('findBannedPhrases — normalized pass catches LLM-evasion tricks', () => {
  it('hyphen-separated letters: "g-u-a-r-a-n-t-e-e-d approval"', () => {
    const hits = findBannedPhrases('g-u-a-r-a-n-t-e-e-d approval today')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('space-separated letters: "c r e d i t repair"', () => {
    const hits = findBannedPhrases('Try our c r e d i t repair plan')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('punctuation-inserted: "100 % approval"', () => {
    const hits = findBannedPhrases('We give 100 % approval rates!')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('underscores between letters: "no_credit_check"', () => {
    const hits = findBannedPhrases('Try no_credit_check loans here')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('does not double-flag when both raw and normalized passes match', () => {
    const hits = findBannedPhrases('guaranteed approval')
    const sources = hits.map((h) => h.phrase)
    expect(new Set(sources).size).toBe(sources.length)
  })
})

describe('findBannedPhrases — tenant ban list', () => {
  it('flags tenant-specific phrases', () => {
    const hits = findBannedPhrases('We can beat any competitor', ['beat any competitor'])
    expect(hits.some((h) => h.phrase === 'beat any competitor')).toBe(true)
  })

  it('tenant phrases are case-insensitive', () => {
    const hits = findBannedPhrases('We GUARANTEE results', ['guarantee results'])
    expect(hits.some((h) => h.phrase === 'guarantee results')).toBe(true)
  })

  it('escapes regex metacharacters in tenant phrases', () => {
    const hits = findBannedPhrases('Pay $1000 today', ['$1000'])
    expect(hits.some((h) => h.phrase === '$1000')).toBe(true)
  })

  it('skips empty entries in tenant ban list', () => {
    expect(() => findBannedPhrases('hi', ['', 'real'])).not.toThrow()
  })

  it('does not double-flag a tenant phrase via the normalized pass', () => {
    const hits = findBannedPhrases('We will guarantee results', ['guarantee results'])
    const tenantHits = hits.filter((h) => h.phrase === 'guarantee results')
    expect(tenantHits.length).toBe(1)
  })
})
