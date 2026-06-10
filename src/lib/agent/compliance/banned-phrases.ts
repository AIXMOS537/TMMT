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

export function findBannedPhrases(body: string, tenantBanList: string[] = []): BannedPhraseHit[] {
  const hits: BannedPhraseHit[] = []
  for (const re of CORE_BANNED) {
    const m = body.match(re)
    if (m) hits.push({ phrase: re.source, match: m[0] })
  }
  for (const phrase of tenantBanList) {
    if (!phrase) continue
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = body.match(new RegExp(escaped, 'i'))
    if (m) hits.push({ phrase, match: m[0] })
  }
  return hits
}
