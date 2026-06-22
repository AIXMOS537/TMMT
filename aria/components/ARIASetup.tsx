'use client'
import { useRef, useState } from 'react'

const FACE_SERVER = 'http://localhost:7788'

export default function ARIASetup({ onComplete }: { onComplete: () => void }) {
  const [faceOk, setFaceOk]   = useState(false)
  const [voiceOk, setVoiceOk] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const faceRef  = useRef<HTMLInputElement>(null)
  const voiceRef = useRef<HTMLInputElement>(null)

  async function uploadFace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading('face'); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${FACE_SERVER}/extract-portrait`, { method: 'POST', body: form })
      if (res.ok) { setFaceOk(true) }
      else { const d = await res.json(); setError(d.error ?? 'Upload failed') }
    } catch { setError('Face server not running — run: bash scripts/aria-face-setup.sh') }
    setLoading(null)
  }

  async function uploadVoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading('voice'); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${FACE_SERVER}/set-voice`, { method: 'POST', body: form })
      if (res.ok) { setVoiceOk(true) }
      else { const d = await res.json(); setError(d.error ?? 'Upload failed') }
    } catch { setError('Face server not running — run: bash scripts/aria-face-setup.sh') }
    setLoading(null)
  }

  const btnStyle = (done: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    background: done ? '#0ff1' : '#111',
    color: done ? '#0ff' : '#888',
    border: `1px solid ${done ? '#0ff' : '#333'}`,
    borderRadius: 6,
    cursor: done ? 'default' : 'pointer',
    fontSize: 13,
    letterSpacing: 1,
    width: '100%',
    textAlign: 'left',
  })

  return (
    <div style={{ padding: 24, border: '1px solid #0ff3', borderRadius: 8, maxWidth: 360, background: '#0a0a0a' }}>
      <p style={{ color: '#0ff', fontSize: 12, letterSpacing: 2, marginBottom: 16 }}>ARIA SETUP</p>
      <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
        Upload a face photo or video and a voice sample to bring ARIA to life.
      </p>

      {/* Face upload */}
      <div style={{ marginBottom: 12 }}>
        <button style={btnStyle(faceOk)} onClick={() => !faceOk && faceRef.current?.click()} disabled={!!loading}>
          {loading === 'face' ? '⟳ Processing...' : faceOk ? '✓ Face set' : '+ Upload face photo or video'}
        </button>
        <input ref={faceRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={uploadFace} />
        <p style={{ color: '#444', fontSize: 11, marginTop: 4 }}>JPG, PNG, MP4, MOV — best face frame auto-selected</p>
      </div>

      {/* Voice upload */}
      <div style={{ marginBottom: 16 }}>
        <button style={btnStyle(voiceOk)} onClick={() => !voiceOk && voiceRef.current?.click()} disabled={!!loading}>
          {loading === 'voice' ? '⟳ Processing...' : voiceOk ? '✓ Voice set' : '+ Upload voice sample'}
        </button>
        <input ref={voiceRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={uploadVoice} />
        <p style={{ color: '#444', fontSize: 11, marginTop: 4 }}>WAV or MP3, 5-30 seconds of clear speech</p>
      </div>

      {error && <p style={{ color: '#f44', fontSize: 12, marginBottom: 12 }}>{error}</p>}

      {faceOk && voiceOk && (
        <button
          onClick={onComplete}
          style={{ width: '100%', padding: '12px', background: '#0ff', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, letterSpacing: 2 }}
        >
          ACTIVATE ARIA →
        </button>
      )}

      {(!faceOk || !voiceOk) && (
        <button onClick={onComplete} style={{ width: '100%', padding: '8px', background: 'transparent', color: '#444', border: 'none', cursor: 'pointer', fontSize: 12 }}>
          Skip setup (text only)
        </button>
      )}
    </div>
  )
}
