/**
 * Redacts high-confidence regulated PII (SSNs, payment card numbers) out of
 * free-text lead/agent conversation turns before they cross a system
 * boundary — the Anthropic API (buildSystemPrompt) or Slack/iMessage
 * (handoffToHuman). Names, addresses, and general case details are left
 * intact: those are needed for the agent/human receiving this text to do
 * their job. This only targets patterns that have no legitimate reason to
 * leave the system unredacted.
 *
 * Deliberately conservative to avoid false positives on legitimate long
 * numbers (order IDs, phone numbers already redacted elsewhere, etc.):
 * - SSN: only the unambiguous dashed format (###-##-####)
 * - Card numbers: 13-19 digit runs (with optional space/dash separators)
 *   that pass a Luhn checksum — an un-dashed 16-digit phone/account number
 *   that happens to appear would almost never also be Luhn-valid.
 */

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
// Starts and ends on a digit (never eats a leading/trailing separator or space)
// so "card 4111111111111111 please" doesn't swallow the space before "please".
const CARD_CANDIDATE_PATTERN = /\b\d(?:[ -]?\d){12,18}\b/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function redactPii(text: string): string {
  if (!text) return text;
  let out = text.replace(SSN_PATTERN, '[redacted-ssn]');
  out = out.replace(CARD_CANDIDATE_PATTERN, (match) => {
    const digits = match.replace(/[ -]/g, '');
    if (digits.length < 13 || digits.length > 19) return match;
    return luhnValid(digits) ? '[redacted-card]' : match;
  });
  return out;
}
