// Compliance output guard for member-facing AI (AIXMOS Pocket and friends).
//
// The network's non-negotiable rule: we speak "credit GUIDANCE / coaching /
// education", never "credit repair / fix / delete", and we NEVER promise score
// or income outcomes ("guarantee", "100%"). See docs/sops/CREDIT-GUIDANCE-SOP.md,
// docs/ops-company-policy.md, docs/CREDIT-FUNDING-COMPLIANCE.md.
//
// This is defense-in-depth: the brain's system prompt already forbids these, and
// this guard catches anything that slips through BEFORE it reaches a member.

export interface ComplianceResult {
  /** The text safe to show the member (rewritten if needed, or a safe fallback). */
  text: string;
  /** Forbidden phrases that were found in the original text. */
  violations: string[];
  /** True when the original had to be blocked/replaced with a safe fallback. */
  blocked: boolean;
}

// Phrase → compliant replacement. Order matters (longer/more specific first).
const REWRITES: ReadonlyArray<[RegExp, string]> = [
  [/\bcredit repair\b/gi, "credit guidance"],
  [/\brepair(?:ing)? (?:your )?credit\b/gi, "work on your credit"],
  [/\bfix(?:ing|ed)? (?:your )?credit\b/gi, "work on your credit"],
  [/\bdelete[ds]? .{0,30}credit report\b/gi, "review items on your credit report"],
  [/\b(?:erase|wipe|remove|delete)\w* .{0,20}\b(?:negative|bad|derogatory)\b.{0,20}\b(?:items?|accounts?|marks?|debts?)\b/gi, "review items on your credit report"],
  [/\bguaranteed income\b/gi, "income based on real, collected sales"],
  [/\bguarantee\w*/gi, "may help"],
  [/\b100\s?%/gi, "a lot"],
];

// Anything still matching these AFTER rewrite means we cannot safely show it.
const HARD_BLOCK =
  /\b(credit repair|fix(?:ing)? your credit|repair(?:ing)? your credit|guarantee)\b/i;

const SAFE_FALLBACK =
  "I can help with credit guidance and education — building a plan and learning " +
  "the next step. I can't promise any specific score or outcome, and for anything " +
  "that needs a licensed professional I'll point you to one. What would you like " +
  "to work on?";

/** Find forbidden phrases in text (read-only; no rewrite). */
export function scanCompliance(text: string): string[] {
  const found = new Set<string>();
  for (const [re] of REWRITES) {
    const m = text.match(re);
    if (m) m.forEach((s) => s.trim() && found.add(s.trim().toLowerCase()));
  }
  return [...found];
}

/**
 * Enforce compliance on AI output. Rewrites known phrases; if a hard-blocked
 * term still survives, replaces the whole reply with a safe fallback. Always
 * reports what it found so the caller can log it for audit.
 */
export function enforceCompliance(original: string): ComplianceResult {
  const violations = scanCompliance(original);
  if (violations.length === 0) {
    return { text: original, violations, blocked: false };
  }

  let text = original;
  for (const [re, repl] of REWRITES) {
    text = text.replace(re, repl);
  }
  text = text.replace(/\s{2,}/g, " ").trim();

  if (HARD_BLOCK.test(text)) {
    return { text: SAFE_FALLBACK, violations, blocked: true };
  }
  return { text, violations, blocked: false };
}
