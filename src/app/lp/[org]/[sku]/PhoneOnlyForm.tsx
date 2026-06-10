'use client'

import { useState } from 'react'

interface Props {
  orgSlug: string
  sku: string
  cta: string
  utm: {
    utm_source: string
    utm_medium: string
    utm_campaign: string
    utm_content: string
    utm_term: string
  }
}

export default function PhoneOnlyForm({ orgSlug, sku, cta, utm }: Props) {
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (status === 'submitting') return
    if (phone.replace(/\D/g, '').length < 10) {
      setStatus('error'); setErrorMsg('Please enter a valid phone number.')
      return
    }
    setStatus('submitting'); setErrorMsg('')

    const landing_url = typeof window !== 'undefined' ? window.location.href : ''
    const referrer_url = typeof document !== 'undefined' ? document.referrer : ''

    try {
      const resp = await fetch(`/api/leads/webhook?org=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone, sku,
          source: 'landing_page',
          ...utm,
          landing_url, referrer_url,
        }),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as { error?: string }))
        setStatus('error'); setErrorMsg(data.error || `Submit failed (${resp.status}).`)
        return
      }
      setStatus('ok')
    } catch {
      setStatus('error'); setErrorMsg('Network error — try again.')
    }
  }

  if (status === 'ok') {
    return (
      <div style={{
        background: '#7fffd4', color: '#000', padding: '20px 16px',
        borderRadius: 12, textAlign: 'center', fontSize: 18, fontWeight: 600
      }}>
        Got it. Texting you now — check your messages.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        type="tel"
        inputMode="tel"
        placeholder="(555) 123-4567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoComplete="tel"
        style={{
          padding: '16px', fontSize: 18, borderRadius: 10,
          border: '1px solid #333', background: '#111', color: '#fff'
        }}
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          padding: '16px', fontSize: 18, fontWeight: 600,
          borderRadius: 10, border: 'none', cursor: 'pointer',
          background: status === 'submitting' ? '#444' : '#7fffd4',
          color: '#000'
        }}
      >
        {status === 'submitting' ? 'Sending…' : cta}
      </button>
      {status === 'error' && (
        <div style={{ fontSize: 14, color: '#ff7f7f' }}>{errorMsg}</div>
      )}
    </form>
  )
}
