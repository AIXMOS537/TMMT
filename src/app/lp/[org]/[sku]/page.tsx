/**
 * Landing page template — one route per (org, sku) pair.
 * Mobile-first, single-step phone-only form. UTM-driven variant rendering.
 * POSTs to /api/leads/webhook?org=<slug>
 *
 * Customer-facing strings live in ./copy so copy-compliance.test.ts can assert
 * against them without importing this server component.
 */
import PhoneOnlyForm from './PhoneOnlyForm'
import { COPY, ORG_BRAND } from './copy'

export const dynamic = 'force-dynamic'

export default async function LandingPage({ params, searchParams }: {
  params: Promise<{ org: string; sku: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { org: orgParam, sku: skuParam } = await params
  const sp = await searchParams
  const copy = COPY[skuParam] ?? COPY['lead-magnet']
  const brand = ORG_BRAND[orgParam] ?? { name: 'TMMT', tagline: '' }
  const utm = {
    utm_source: sp.utm_source ?? '',
    utm_medium: sp.utm_medium ?? '',
    utm_campaign: sp.utm_campaign ?? '',
    utm_content: sp.utm_content ?? '',
    utm_term: sp.utm_term ?? '',
  }

  return (
    <div style={{
      fontFamily: '-apple-system, system-ui, sans-serif',
      background: '#0a0a0a', color: '#fff', minHeight: '100vh',
      padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>{brand.name}</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, marginBottom: 12 }}>{copy.headline}</h1>
        <p style={{ fontSize: 17, opacity: 0.85, marginBottom: 24, lineHeight: 1.4 }}>{copy.subhead}</p>

        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
          {copy.bullets.map((b, i) => (
            <li key={i} style={{ padding: '8px 0', borderTop: i === 0 ? '1px solid #222' : undefined, borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#7fffd4' }}>✓</span>
              <span style={{ fontSize: 15 }}>{b}</span>
            </li>
          ))}
        </ul>

        <PhoneOnlyForm
          orgSlug={orgParam}
          sku={skuParam}
          cta={copy.cta}
          utm={utm}
        />

        {copy.proof && (
          <p style={{ fontSize: 13, opacity: 0.6, marginTop: 16, textAlign: 'center' }}>{copy.proof}</p>
        )}

        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 32, lineHeight: 1.5 }}>
          By submitting your phone, you consent to receive SMS messages from {brand.name}. Msg &amp; data rates may apply. Reply STOP to opt out.
          {' '}Credit decisions are made by lenders, not us. Funding amounts are estimates; actual amounts depend on lender review.
          {' '}We provide education and funding-readiness review — we do not perform credit repair, dispute items on your behalf, or promise any credit score result. Individual outcomes differ and past client experiences do not predict yours.
        </p>
      </div>
    </div>
  )
}
