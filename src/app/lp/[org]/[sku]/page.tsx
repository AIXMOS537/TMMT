/**
 * Landing page template — one route per (org, sku) pair.
 * Mobile-first, single-step phone-only form. UTM-driven variant rendering.
 * POSTs to /api/leads/webhook?org=<slug>
 *
 * Customer-facing strings live in ./copy so copy-compliance.test.ts can assert
 * against them without importing this server component.
 */
import PhoneOnlyForm from './PhoneOnlyForm'
import { COPY } from './copy'
import BrandLogo from '@/components/brand/BrandLogo'
import BrandProvider from '@/components/brand/BrandProvider'
import { brandMetadata, brandViewport } from '@/lib/platform/brand-metadata'
import { tenantOrDefault } from '@/lib/platform/tenant-resolve'

const LP_FALLBACK_TENANT = 'tmmt_property'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ org: string; sku: string }> }) {
  const { org } = await params
  return brandMetadata(tenantOrDefault(org, LP_FALLBACK_TENANT))
}

export async function generateViewport({ params }: { params: Promise<{ org: string; sku: string }> }) {
  const { org } = await params
  return brandViewport(tenantOrDefault(org, LP_FALLBACK_TENANT))
}

export default async function LandingPage({ params, searchParams }: {
  params: Promise<{ org: string; sku: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { org: orgParam, sku: skuParam } = await params
  const sp = await searchParams
  const copy = COPY[skuParam] ?? COPY['lead-magnet']
  const brand = tenantOrDefault(orgParam, LP_FALLBACK_TENANT)
  const utm = {
    utm_source: sp.utm_source ?? '',
    utm_medium: sp.utm_medium ?? '',
    utm_campaign: sp.utm_campaign ?? '',
    utm_content: sp.utm_content ?? '',
    utm_term: sp.utm_term ?? '',
  }

  return (
    <BrandProvider
      brand={brand}
      paint
      style={{
        fontFamily: '-apple-system, system-ui, sans-serif',
        minHeight: '100vh',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ marginBottom: 16 }}>
          <BrandLogo brand={brand} size={32} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, marginBottom: 12 }}>{copy.headline}</h1>
        <p style={{ fontSize: 17, opacity: 0.85, marginBottom: 24, lineHeight: 1.4 }}>{copy.subhead}</p>

        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
          {copy.bullets.map((b, i) => (
            <li key={i} style={{ padding: '8px 0', borderTop: i === 0 ? '1px solid var(--brand-border)' : undefined, borderBottom: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--brand-primary)' }}>✓</span>
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
          By submitting your phone, you consent to receive SMS messages from {brand.displayName}. Msg &amp; data rates may apply. Reply STOP to opt out.
          {' '}Credit decisions are made by lenders, not us. Funding amounts are estimates; actual amounts depend on lender review.
          {' '}We provide education and funding-readiness review — we do not perform credit repair, dispute items on your behalf, or promise any credit score result. Individual outcomes differ and past client experiences do not predict yours.
        </p>
      </div>
    </BrandProvider>
  )
}
