/**
 * Landing page template — one route per (org, sku) pair.
 * Mobile-first, single-step phone-only form. UTM-driven variant rendering.
 * POSTs to /api/leads/webhook?org=<slug>
 */
import PhoneOnlyForm from './PhoneOnlyForm'

interface SkuCopy {
  headline: string
  subhead: string
  bullets: string[]
  cta: string
  proof?: string
}

const COPY: Record<string, SkuCopy> = {
  'lead-magnet': {
    headline: 'Get the free Credit + Funding Playbook',
    subhead: 'The same checklist our paid clients pay $7K+ to walk through. Text it to your phone in 30 seconds.',
    bullets: [
      'What lenders actually look at (and what they ignore)',
      'How to fix the 3 most common credit-report mistakes',
      'Where to find funding most people never hear about',
    ],
    cta: 'Text me the playbook',
    proof: '12,000+ playbooks downloaded',
  },
  'intro-97': {
    headline: 'Credit + Funding Audit — $97',
    subhead: 'Real human eyes on your report + a 30-minute call with an AIXMOS Credit advisor.',
    bullets: [
      'Personalized review of your full credit file',
      '30-minute strategy call (recorded for you)',
      'Written action plan emailed within 24 hours',
    ],
    cta: 'Start my $97 audit',
    proof: 'Average client adds 47 points in 90 days. Results vary.',
  },
  'training': {
    headline: 'TMMT Academy — Operator Cohort',
    subhead: 'Run your own fleet on our brain. Become a TMMT-certified operator.',
    bullets: [
      'Live 6-week cohort with weekly office hours',
      'The AIXMOS agent playbook a real rental company runs on — scripts, templates, OPERATIONS_BRAIN',
      'Lifetime alumni Slack + ongoing playbook updates',
    ],
    cta: 'Apply for the next cohort',
  },
  'rental-in-a-box': {
    headline: 'Rental-in-a-Box',
    subhead: 'Pre-built car-rental business operating system, ready in 7 days.',
    bullets: [
      'Full fleet management SOPs + automation',
      'Renter intake, screening, and turnover workflow',
      'Credit + funding lane connected via AIXMOS Credit',
    ],
    cta: 'See if I qualify',
  },
  'flagship': {
    headline: 'Full Empire Build',
    subhead: 'White-glove buildout of your entire AI-run business — agents, funnels, and operators.',
    bullets: [
      'Dedicated buildout team for 60 days',
      'Custom branding, white-label license',
      'Lifetime access to the AIXMOS agent stack',
    ],
    cta: 'Schedule a discovery call',
  },
}

const ORG_BRAND: Record<string, { name: string; tagline: string }> = {
  aixmos:        { name: 'AIXMOS',          tagline: 'The AI engine — agents that answer, follow up, and close 24/7' },
  moe_legacy:    { name: 'AIXMOS Credit',   tagline: 'The go-to for getting funding-ready and funded' },
  tmmt_property: { name: 'TMMT',            tagline: 'The car rental agency that teaches you to run your own fleet' },
}

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
        </p>
      </div>
    </div>
  )
}
