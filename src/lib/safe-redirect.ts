/**
 * Same-app redirect targets only (C3-003).
 *
 * The old check was `next.startsWith("/") && !next.startsWith("//")`. Two inputs pass
 * it and still leave the site, because the WHATWG URL parser (what `new URL()` and
 * browsers use) treats a backslash like `/` for http(s) and silently strips tab / CR /
 * LF:
 *   "/<backslash>evil.com"  → "//evil.com"  → https://evil.com/
 *   "/<tab>/evil.com"       → "//evil.com"  → https://evil.com/
 *
 * So the rule here is structural, not a prefix match: refuse control characters and
 * backslashes outright, then PARSE the candidate against a fixed internal origin and
 * accept it only if it is still on that origin. What comes back is rebuilt from the
 * parsed path/query/hash, never the raw string.
 */

const INTERNAL = "https://app.internal.invalid";
const MAX_LEN = 512;
const BACKSLASH = 0x5c;
const DEL = 0x7f;

/** Any C0 control character, DEL, or a backslash. */
function hasUnsafeChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === DEL || c === BACKSLASH) return true;
  }
  return false;
}

export function safeRelativePath(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LEN) return fallback;
  if (hasUnsafeChar(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, INTERNAL);
  } catch {
    return fallback;
  }
  // Redundant with the checks above by construction; kept as a second, independent layer.
  if (url.origin !== INTERNAL) return fallback;
  const out = `${url.pathname}${url.search}${url.hash}`;
  return out.startsWith("/") && !out.startsWith("//") ? out : fallback;
}
