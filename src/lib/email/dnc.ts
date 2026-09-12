/**
 * Email address normalisation for the suppression list.
 *
 * "Bob@Example.COM " and "bob@example.com" are one human being. A block list
 * that treats them as two people is not a block list — it is a list that lets
 * anyone who typed their address with a capital letter keep getting mail after
 * they asked us to stop. So every read and every write goes through here.
 *
 * Deliberately NOT doing gmail dot-stripping or plus-tag removal: those are
 * provider-specific folklore, they are wrong for several providers, and
 * silently suppressing `bob+rentals@` because `bob@` opted out would drop mail
 * the person may still want. Case and whitespace only.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim().toLowerCase()
  // One @, something before it, a dot-bearing domain after it. Not RFC 5322 —
  // deliberately. This is a suppression key, not an address validator.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null
  return t
}
