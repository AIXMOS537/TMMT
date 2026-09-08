/**
 * Phone normalisation — one module, two documented policies.
 *
 * Two implementations used to disagree on the same input (remediation F-12):
 * the public lead webhook rejected anything that was not a 10/11-digit NANP
 * number, while the people upsert accepted any 7+ digit string and prefixed
 * "+". Both behaviours are deliberate for their callers — a public form should
 * not accept "12345" as a phone, and an imported contact from a foreign source
 * should not be thrown away — so both are kept, named for what they do, and
 * every caller says which one it means.
 */

/** All digits, or null when there are fewer than `min`. */
export function phoneDigits(raw: string | null | undefined, min = 7): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length >= min ? d : null;
}

/** Last ten digits, the key used by do-not-contact and payment matching. */
export function phoneLast10(raw: string | null | undefined): string | null {
  const d = phoneDigits(raw, 10);
  return d ? d.slice(-10) : null;
}

/**
 * STRICT: North American numbers only. 10 digits, or 11 starting with 1,
 * become +1XXXXXXXXXX; everything else is null. Use at public entry points.
 */
export function normalizeNanpPhone(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

/**
 * LOOSE: best-effort E.164 for records that already exist somewhere else.
 * NANP numbers get +1; anything else with 7+ digits is returned as +<digits>
 * unchanged, so an international contact is kept rather than dropped.
 */
export function normalizePhoneLoose(raw: string | null | undefined): string | null {
  const d = phoneDigits(raw, 7);
  if (!d) return null;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}
