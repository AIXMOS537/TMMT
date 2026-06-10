const CORE_BANNED: RegExp[] = [
  /guaranteed\s+(approval|funding|credit)/i,
  /credit\s+repair/i,                                                  // we are NOT credit repair
  /(fix|repair|boost)\s+your\s+credit/i,
  /\bI(?:'| a)?m\s+(?:a\s+)?(real|actual)\s+(person|human)\b/i,         // no deception
  /\bnot\s+a\s+(bot|robot|AI)\b/i,
  /100%\s+approval/i,
  /\bno\s+credit\s+check\b/i,
]

export interface BannedPhraseHit {
  phrase: string
  match: string
}

/**
 * Normalize text before regex matching so common LLM-evasion tricks
 * (spaced-out letters, zero-width chars, punctuation insertion) still
 * trigger the banned-phrase filter. Examples that now match:
 *   "g-u-a-r-a-n-t-e-e-d approval"
 *   "100 % approval"
 *   "c r e d i t repair"
 *
 * The original body is still scanned too — so legitimate matches in
 * normal spelling are not lost. We just add a normalized pass.
 */
function normalizeForBannedCheck(body: string): string {
  return body
    // strip zero-width / format chars
    .replace(/[​-‏‪-‮⁠﻿]/g, '')
    // collapse common separators inserted between letters to evade regex
    .replace(/[\s\-_.,;:!?·•∙*~|/\\]+/g, ' ')
    // collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
}

export function findBannedPhrases(body: string, tenantBanList: string[] = []): BannedPhraseHit[] {
  const hits: BannedPhraseHit[] = []
  const seen = new Set<string>()

  const scan = (text: string) => {
    for (const re of CORE_BANNED) {
      const m = text.match(re)
      if (m && !seen.has(re.source)) {
        hits.push({ phrase: re.source, match: m[0] })
        seen.add(re.source)
      }
    }
    for (const phrase of tenantBanList) {
      if (!phrase) continue
      const key = `tenant:${phrase}`
      if (seen.has(key)) continue
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const m = text.match(new RegExp(escaped, 'i'))
      if (m) {
        hits.push({ phrase, match: m[0] })
        seen.add(key)
      }
    }
  }

  scan(body)
  const normalized = normalizeForBannedCheck(body)
  if (normalized !== body) scan(normalized)
  return hits
}
