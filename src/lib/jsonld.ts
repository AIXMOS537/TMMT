/**
 * LocalBusiness + Service JSON-LD, built from the intake answers we already have.
 *
 * Why this exists: answer engines read structured data. A client whose site
 * carries correct LocalBusiness markup can be named in an AI answer; one whose
 * site does not, mostly cannot. It is one of the cheapest things we can hand a
 * client, because we already asked them every question it needs at intake.
 *
 * THE ONE RULE: never emit a property we do not have real data for.
 *
 * That is not tidiness. Structured data is a set of machine-readable claims
 * about a real business — an invented `priceRange`, a guessed `areaServed`, or
 * an `aggregateRating` with no reviews behind it is a false claim published in
 * the client's name, and the rating one is specifically against Google's
 * guidelines and gets a site penalised. So every field here is optional,
 * every blank is dropped, and there is no default value anywhere in this file.
 * `omitEmpty` is the whole design.
 *
 * Pure functions only — no network, no env, no clock. Feed it answers, get an
 * object. The page that renders it decides where the script tag goes.
 */

export type IntakeAnswers = {
  businessName?: string | null
  description?: string | null
  /** Public site URL. */
  url?: string | null
  phone?: string | null
  email?: string | null
  street?: string | null
  city?: string | null
  /** Two-letter state, e.g. "VA". */
  region?: string | null
  postalCode?: string | null
  country?: string | null
  /** Cities/counties served, e.g. ["Alexandria", "Arlington"]. */
  areaServed?: string[] | null
  /** What they sell, in their words. Becomes Service nodes. */
  services?: string[] | null
  /** schema.org type, e.g. "AutoRental". Falls back to LocalBusiness. */
  businessType?: string | null
  /** Opening hours as already collected, e.g. ["Mo-Fr 09:00-17:00"]. */
  openingHours?: string[] | null
  /** "$", "$$", "$$$", "$$$$" only. Anything else is dropped. */
  priceRange?: string | null
  sameAs?: string[] | null
}

/** schema.org types we will emit. Anything unrecognised becomes LocalBusiness. */
export const ALLOWED_BUSINESS_TYPES = [
  'LocalBusiness',
  'AutoRental',
  'AutoRepair',
  'AutoWash',
  'MovingCompany',
  'HomeAndConstructionBusiness',
  'ProfessionalService',
  'Store',
] as const
export type BusinessType = (typeof ALLOWED_BUSINESS_TYPES)[number]

const PRICE_RANGES = new Set(['$', '$$', '$$$', '$$$$'])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>

/** Trimmed string, or undefined. Empty and whitespace-only are the same thing. */
function str(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : undefined
}

/** Trimmed, de-duplicated, non-empty entries — or undefined if none survive. */
function list(v: string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = [...new Set(v.map((s) => (s ?? '').trim()).filter((s) => s.length > 0))]
  return out.length > 0 ? out : undefined
}

/** Drop every key whose value is undefined, an empty array, or an empty object. */
export function omitEmpty(obj: Json): Json {
  const out: Json = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      if (v.length === 0) continue
      out[k] = v
      continue
    }
    if (typeof v === 'object') {
      const inner = omitEmpty(v as Json)
      // A node carrying only its @type says nothing; drop it.
      if (Object.keys(inner).filter((key) => key !== '@type').length === 0) continue
      out[k] = inner
      continue
    }
    out[k] = v
  }
  return out
}

export function businessTypeOf(raw: string | null | undefined): BusinessType {
  const t = str(raw)
  return (ALLOWED_BUSINESS_TYPES as readonly string[]).includes(t ?? '')
    ? (t as BusinessType)
    : 'LocalBusiness'
}

/** PostalAddress, or undefined when we know nothing about where they are. */
export function postalAddress(a: IntakeAnswers): Json | undefined {
  const node = omitEmpty({
    '@type': 'PostalAddress',
    streetAddress: str(a.street),
    addressLocality: str(a.city),
    addressRegion: str(a.region),
    postalCode: str(a.postalCode),
    addressCountry: str(a.country),
  })
  return Object.keys(node).length > 1 ? node : undefined
}

export function localBusinessJsonLd(a: IntakeAnswers): Json {
  const price = str(a.priceRange)
  return omitEmpty({
    '@context': 'https://schema.org',
    '@type': businessTypeOf(a.businessType),
    name: str(a.businessName),
    description: str(a.description),
    url: str(a.url),
    telephone: str(a.phone),
    email: str(a.email),
    address: postalAddress(a),
    areaServed: list(a.areaServed)?.map((n) => ({ '@type': 'Place', name: n })),
    openingHours: list(a.openingHours),
    // Only the four schema.org-valid tokens. "Affordable" or "$50-$200" is dropped.
    priceRange: price && PRICE_RANGES.has(price) ? price : undefined,
    sameAs: list(a.sameAs),
  })
}

/** One Service node per service they named. No price — we were not told one. */
export function serviceJsonLd(a: IntakeAnswers): Json[] {
  const services = list(a.services)
  if (!services) return []
  const providerName = str(a.businessName)
  const areas = list(a.areaServed)
  return services.map((name) =>
    omitEmpty({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name,
      provider: providerName
        ? omitEmpty({ '@type': businessTypeOf(a.businessType), name: providerName })
        : undefined,
      areaServed: areas?.map((n) => ({ '@type': 'Place', name: n })),
    }),
  )
}

/**
 * Everything we can honestly say, as a @graph.
 *
 * Returns an EMPTY ARRAY when we know nothing worth publishing — a business
 * with no name is not a business, and emitting a bare `{"@type":"LocalBusiness"}`
 * is noise that makes the page look marked-up when it is not. The caller is
 * expected to render nothing at all in that case.
 */
export function buildJsonLd(a: IntakeAnswers): Json[] {
  const biz = localBusinessJsonLd(a)
  const hasSubstance = Object.keys(biz).some((k) => !k.startsWith('@'))
  const nodes: Json[] = hasSubstance ? [biz] : []
  return [...nodes, ...serviceJsonLd(a)]
}

/**
 * Serialise for a <script type="application/ld+json"> tag.
 *
 * `<` is escaped as < so a value containing "</script>" cannot close the
 * tag early and turn client-supplied intake text into executable markup. This
 * is the one security-relevant line in the file: every string in here came from
 * a form someone else filled in.
 */
export function jsonLdScriptBody(nodes: Json[]): string {
  if (nodes.length === 0) return ''
  const payload = nodes.length === 1 ? nodes[0] : { '@context': 'https://schema.org', '@graph': nodes }
  return JSON.stringify(payload).replace(/</g, '\\u003c')
}
