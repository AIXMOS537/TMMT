import { NextRequest, NextResponse } from 'next/server'
import { guardTextForDestination } from '../../../lib/pii-guard'

const FACE_SERVER = process.env.ARIA_FACE_SERVER || 'http://127.0.0.1:7788'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

  // Family/PII firewall: audio is derived from this text and shipped to the
  // face server. If that server is non-local, redact PII first so personal data
  // never leaves the home mesh. Local (loopback/.local/tailnet) is left intact.
  const guarded = guardTextForDestination(text, FACE_SERVER)
  const speakText = guarded.text
  if (guarded.redacted) {
    console.warn(`[aria/avatar] redacted PII before non-local send: ${guarded.kinds.join(', ')}`)
  }

  // Step 1: synthesize voice
  let audioBuffer: ArrayBuffer | null = null
  let audioType = 'audio/wav'
  try {
    const voiceRes = await fetch(new URL('/api/voice', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: speakText }),
      signal: AbortSignal.timeout(15000),
    })
    if (voiceRes.ok) {
      const ct = voiceRes.headers.get('Content-Type') ?? ''
      if (ct.startsWith('audio/')) {
        audioBuffer = await voiceRes.arrayBuffer()
        audioType = ct
      }
    }
  } catch { /* audio failed, try animate without audio */ }

  if (!audioBuffer) {
    return NextResponse.json({ fallback: true, audioOnly: false, reason: 'voice synthesis failed' }, { status: 200 })
  }

  // Step 2: animate portrait with audio
  try {
    const form = new FormData()
    form.append('audio', new Blob([audioBuffer], { type: audioType }), 'speech.wav')

    const animRes = await fetch(`${FACE_SERVER}/animate`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    })

    if (animRes.ok) {
      const ct = animRes.headers.get('Content-Type') ?? ''
      if (ct.startsWith('video/')) {
        const video = await animRes.arrayBuffer()
        return new NextResponse(video, { headers: { 'Content-Type': 'video/mp4', 'X-Avatar-Source': 'liveportrait', 'X-PII-Redacted': guarded.redacted ? '1' : '0' } })
      }
    }
  } catch { /* animation failed — return audio only */ }

  // Fallback: return audio only
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': audioType,
      'X-Avatar-Source': 'audio-only',
      'X-PII-Redacted': guarded.redacted ? '1' : '0',
    },
  })
}
