import { describe, it, expect } from 'vitest'
import {
  buildJsonLd,
  localBusinessJsonLd,
  serviceJsonLd,
  postalAddress,
  businessTypeOf,
  omitEmpty,
  jsonLdScriptBody,
  type IntakeAnswers,
} from '@/lib/jsonld'

const full: IntakeAnswers = {
  businessName: 'Example Rentals',
  description: 'Car rental in the DMV.',
  url: 'https://example.com',
  phone: '+17035550100',
  email: 'hi@example.com',
  street: '1 Main St',
  city: 'Alexandria',
  region: 'VA',
  postalCode: '22301',
  country: 'US',
  areaServed: ['Alexandria', 'Arlington'],
  services: ['Daily car rental', 'Weekly car rental'],
  businessType: 'AutoRental',
  openingHours: ['Mo-Fr 09:00-17:00'],
  priceRange: '$$',
}

describe('the one rule: never emit a property we do not have', () => {
  it('emits nothing at all for an empty intake', () => {
    expect(buildJsonLd({})).toEqual([])
    expect(jsonLdScriptBody(buildJsonLd({}))).toBe('')
  })

  it('drops blank and whitespace-only answers instead of emitting empty strings', () => {
    const out = localBusinessJsonLd({ businessName: 'A', description: '   ', phone: '' })
    expect(out.name).toBe('A')
    expect('description' in out).toBe(false)
    expect('telephone' in out).toBe(false)
  })

  it('never invents a value that was not supplied', () => {
    const out = localBusinessJsonLd({ businessName: 'A' })
    // The only keys allowed are @-keys and the one fact we were given.
    expect(Object.keys(out).sort()).toEqual(['@context', '@type', 'name'])
  })

  it('never emits aggregateRating — a rating with no reviews is a false claim', () => {
    const body = jsonLdScriptBody(buildJsonLd(full))
    expect(body).not.toContain('aggregateRating')
    expect(body).not.toContain('reviewCount')
  })

  it('omits an address node that would carry only its @type', () => {
    expect(postalAddress({})).toBeUndefined()
    expect(postalAddress({ city: '  ' })).toBeUndefined()
  })

  it('keeps a partial address when we genuinely have part of one', () => {
    expect(postalAddress({ city: 'Alexandria', region: 'VA' })).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Alexandria',
      addressRegion: 'VA',
    })
  })
})

describe('priceRange is only ever a schema.org token', () => {
  it.each(['$', '$$', '$$$', '$$$$'])('keeps %s', (p) => {
    expect(localBusinessJsonLd({ businessName: 'A', priceRange: p }).priceRange).toBe(p)
  })
  it.each(['Affordable', '$50-$200', 'cheap', '$$$$$', ''])('drops %s', (p) => {
    expect('priceRange' in localBusinessJsonLd({ businessName: 'A', priceRange: p })).toBe(false)
  })
})

describe('businessTypeOf', () => {
  it('passes a known schema.org type through', () => {
    expect(businessTypeOf('AutoRental')).toBe('AutoRental')
  })
  it('falls back to LocalBusiness rather than emitting a made-up type', () => {
    for (const t of ['CarRentalPlace', 'random', '', null, undefined]) {
      expect(businessTypeOf(t)).toBe('LocalBusiness')
    }
  })
})

describe('omitEmpty', () => {
  it('drops undefined, null, empty arrays and type-only objects', () => {
    expect(omitEmpty({ a: 1, b: undefined, c: null, d: [], e: { '@type': 'X' }, f: {} })).toEqual({ a: 1 })
  })
  it('keeps a zero and a false — they are real values', () => {
    expect(omitEmpty({ a: 0, b: false })).toEqual({ a: 0, b: false })
  })
})

describe('lists', () => {
  it('de-duplicates and trims areaServed', () => {
    const out = localBusinessJsonLd({ businessName: 'A', areaServed: ['Arlington', ' Arlington ', '', 'Fairfax'] })
    expect(out.areaServed).toEqual([
      { '@type': 'Place', name: 'Arlington' },
      { '@type': 'Place', name: 'Fairfax' },
    ])
  })
})

describe('services', () => {
  it('makes one node per service, with no invented price', () => {
    const svc = serviceJsonLd(full)
    expect(svc).toHaveLength(2)
    expect(svc[0].name).toBe('Daily car rental')
    expect(svc[0].provider).toEqual({ '@type': 'AutoRental', name: 'Example Rentals' })
    expect('offers' in svc[0]).toBe(false)
    expect('price' in svc[0]).toBe(false)
  })
  it('returns nothing when no service was named', () => {
    expect(serviceJsonLd({ businessName: 'A' })).toEqual([])
  })
})

describe('the full shape', () => {
  it('builds a business node plus one node per service', () => {
    const nodes = buildJsonLd(full)
    expect(nodes).toHaveLength(3)
    expect(nodes[0]['@type']).toBe('AutoRental')
  })
  it('wraps multiple nodes in a @graph', () => {
    const parsed = JSON.parse(jsonLdScriptBody(buildJsonLd(full)))
    expect(parsed['@graph']).toHaveLength(3)
    expect(parsed['@context']).toBe('https://schema.org')
  })
  it('emits a single node bare, not in a pointless graph', () => {
    const parsed = JSON.parse(jsonLdScriptBody(buildJsonLd({ businessName: 'A' })))
    expect(parsed['@type']).toBe('LocalBusiness')
    expect('@graph' in parsed).toBe(false)
  })
})

// Every string here came from a form a stranger filled in.
describe('script-tag injection', () => {
  it('escapes < so intake text cannot close the script tag early', () => {
    const body = jsonLdScriptBody(
      buildJsonLd({ businessName: 'Evil</script><script>alert(1)</script>' }),
    )
    expect(body).not.toContain('</script>')
    expect(body).toContain('\\u003c')
  })
  it('still parses back to the original text after escaping', () => {
    const name = 'A <b>bold</b> name'
    const parsed = JSON.parse(jsonLdScriptBody(buildJsonLd({ businessName: name })))
    expect(parsed.name).toBe(name)
  })
})
