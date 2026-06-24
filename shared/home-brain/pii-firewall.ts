/**
 * shared/home-brain/pii-firewall.ts
 *
 * Family/PII firewall. Personal data (the owner's family, clients) NEVER leaves
 * the home mesh into a cloud LLM context — it stays on local Ollama (and the NAS
 * tier). Call assertLocalOnlyForPII() in the model router before any cloud send.
 *
 * Errs toward BLOCKING: over-detection just keeps more data local, which is the
 * safe direction. See root CLAUDE.md §4 ("PII never goes into a cloud LLM context").
 */

export type PiiKind =
  | "ssn"
  | "credit_card"
  | "phone"
  | "email"
  | "dob"
  | "street_address";

export type Destination = "local" | "cloud";

const PATTERNS: ReadonlyArray<{ kind: PiiKind; re: RegExp }> = [
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  // 13–16 digits, optionally space/dash separated (card numbers).
  { kind: "credit_card", re: /\b(?:\d[ -]?){13,16}\b/ },
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  {
    kind: "phone",
    re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  },
  { kind: "dob", re: /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)\d\d\b/ },
  {
    kind: "street_address",
    re: /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place|Ter|Terrace)\b\.?/i,
  },
];

export interface PiiScan {
  hit: boolean;
  kinds: PiiKind[];
}

export function scanForPii(text: string): PiiScan {
  const kinds: PiiKind[] = [];
  for (const { kind, re } of PATTERNS) {
    if (re.test(text)) kinds.push(kind);
  }
  return { hit: kinds.length > 0, kinds };
}

export class PiiFirewallError extends Error {
  constructor(public kinds: PiiKind[]) {
    super(
      `PII FIREWALL: blocked cloud send — detected ${kinds.join(", ")}. ` +
        `Personal/family data stays on the home mesh (local Ollama only).`,
    );
    this.name = "PiiFirewallError";
  }
}

/** Throw if `text` carries PII and the destination is a cloud model. */
export function assertLocalOnlyForPII(text: string, destination: Destination): void {
  if (destination !== "cloud") return;
  const scan = scanForPii(text);
  if (scan.hit) throw new PiiFirewallError(scan.kinds);
}
