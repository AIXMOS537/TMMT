import { NextRequest, NextResponse } from 'next/server'

const FACE_SERVER = process.env.ARIA_FACE_SERVER || 'http://127.0.0.1:7788'
const ELEVENLABS_KEY   = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

  // 1. Local OpenVoice (zero cost, cloned voice)
  try {
    const res = await fetch(`${FACE_SERVER}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      const audio = await res.arrayBuffer()
      return new NextResponse(audio, {
        headers: { 'Content-Type': 'audio/wav', 'X-Voice-Source': 'local-openvoice' },
      })
    }
  } catch { /* fall through */ }

  // 2. ElevenLabs fallback
  if (ELEVENLABS_KEY) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const audio = await res.arrayBuffer()
        return new NextResponse(audio, {
          headers: { 'Content-Type': 'audio/mpeg', 'X-Voice-Source': 'elevenlabs' },
        })
      }
    } catch { /* fall through */ }
  }

  // 3. Browser TTS fallback signal
  return NextResponse.json({ fallback: 'browser-tts', text })
}
