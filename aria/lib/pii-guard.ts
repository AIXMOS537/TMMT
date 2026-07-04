/**
 * aria/lib/pii-guard.ts
 *
 * Family/PII guard for ARIA, the speaking avatar. Self-contained (ARIA is a
 * separate app) but enforces the same rule as shared/home-brain: personal/
 * family data never leaves the home mesh. If the voice/face pipeline points at
 * a NON-local server, any PII in the text is redacted before it (and the audio
 * derived from it) is sent out.
 *
 * Errs toward redaction — over-masking just keeps more data private.
 */

export type PiiKind = 'ssn' | 'credit_card' | 'phone' | 'email' | 'street_address'

const PATTERNS: ReadonlyArray<{ kind: PiiKind; re: RegExp }> = [
  { kind: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'credit_card', re: /\b(?:\d[ -]?){13,16}\b/g },
  { kind: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'phone', re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  {
    kind: 'street_address',
    re: /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place|Ter|Terrace)\b\.?/gi,
  },
]

export interface PiiScan {
  hit: boolean
  kinds: PiiKind[]
}

export function scanForPii(text: string): PiiScan {
  const kinds: PiiKind[] = []
  for (const { kind, re } of PATTERNS) {
    if (new RegExp(re.source, re.flags).test(text)) kinds.push(kind)
  }
  return { hit: kinds.length > 0, kinds }
}

/** Replace any PII run with a mask, preserving the rest of the sentence. */
export function redactPii(text: string): string {
  let out = text
  for (const { re } of PATTERNS) {
    out = out.replace(new RegExp(re.source, re.flags), '▮▮▮')
  }
  return out
}

/**
 * A destination is "local" (safe for PII) if it targets loopback, the .local
 * mDNS domain, or a Tailscale tailnet host (*.ts.net / 100.64.0.0/10 CGNAT).
 */
export function isLocalDestination(urlStr: string): boolean {
  let host: string
  try {
    host = new URL(urlStr).hostname
  } catch {
    return false // unparseable → treat as non-local (fail safe)
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (host.endsWith('.local') || host.endsWith('.ts.net')) return true
  // Tailscale CGNAT range 100.64.0.0/10 (100.64.x.x – 100.127.x.x). Require the
  // WHOLE hostname to be a valid dotted-quad first, so a public DNS name like
  // "100.100.evil.com" cannot masquerade as a tailnet IP and leak PII.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number)
    if (octets.every((o) => o <= 255) && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) {
      return true
    }
  }
  return false
}

/**
 * Return text safe to send to `destination`. If the destination is non-local
 * and the text carries PII, it's redacted. Returns whether anything was masked.
 */
export function guardTextForDestination(
  text: string,
  destination: string,
): { text: string; redacted: boolean; kinds: PiiKind[] } {
  if (isLocalDestination(destination)) return { text, redacted: false, kinds: [] }
  const scan = scanForPii(text)
  if (!scan.hit) return { text, redacted: false, kinds: [] }
  return { text: redactPii(text), redacted: true, kinds: scan.kinds }
}
