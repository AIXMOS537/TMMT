'use client'
import { useEffect, useRef, useState } from 'react'

interface ARIAAvatarProps {
  responding: boolean
  responseText: string
  onSpeechEnd: () => void
}

export default function ARIAAvatar({ responding, responseText, onSpeechEnd }: ARIAAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [hasPortrait, setHasPortrait] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [portraitUrl, setPortraitUrl] = useState('/api/avatar/portrait')

  // Check if portrait exists on mount
  useEffect(() => {
    fetch('/api/avatar/portrait', { method: 'HEAD' })
      .then(r => setHasPortrait(r.ok))
      .catch(() => setHasPortrait(false))
  }, [])

  // Trigger animation when responding + have text
  useEffect(() => {
    if (!responding || !responseText) return

    setAnimating(true)

    fetch('/api/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: responseText }),
    })
      .then(async res => {
        if (!res.ok) { setAnimating(false); onSpeechEnd(); return }
        const ct = res.headers.get('Content-Type') ?? ''
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)

        if (ct.startsWith('video/') && videoRef.current) {
          videoRef.current.src = url
          videoRef.current.onended = () => {
            URL.revokeObjectURL(url)
            setAnimating(false)
            onSpeechEnd()
          }
          videoRef.current.play().catch(() => { setAnimating(false); onSpeechEnd() })
        } else if (ct.startsWith('audio/') && audioRef.current) {
          audioRef.current.src = url
          audioRef.current.onended = () => {
            URL.revokeObjectURL(url)
            setAnimating(false)
            onSpeechEnd()
          }
          audioRef.current.play().catch(() => { setAnimating(false); onSpeechEnd() })
        } else {
          // Browser TTS fallback
          if ('speechSynthesis' in window) {
            const utt = new SpeechSynthesisUtterance(responseText)
            utt.onend = () => { setAnimating(false); onSpeechEnd() }
            speechSynthesis.speak(utt)
          } else {
            setAnimating(false)
            onSpeechEnd()
          }
        }
      })
      .catch(() => { setAnimating(false); onSpeechEnd() })
  }, [responding, responseText]) // eslint-disable-line react-hooks/exhaustive-deps

  const glowStyle: React.CSSProperties = {
    width: 200,
    height: 200,
    borderRadius: '50%',
    border: `2px solid ${animating ? '#0ff' : '#0aa'}`,
    boxShadow: animating
      ? '0 0 24px #0ff, 0 0 48px #0ff4'
      : '0 0 12px #0aa6',
    overflow: 'hidden',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.3s, border-color 0.3s',
    position: 'relative',
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={glowStyle}>
        {/* Animated video (lip-sync) */}
        <video
          ref={videoRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: animating ? 'block' : 'none' }}
          muted={false}
          playsInline
        />
        {/* Still portrait */}
        {hasPortrait && !animating && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitUrl}
            alt="ARIA"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setHasPortrait(false)}
          />
        )}
        {/* Fallback symbol */}
        {!hasPortrait && !animating && (
          <span style={{ fontSize: 64, color: '#0ff', userSelect: 'none' }}>✦</span>
        )}
        {/* Pulse ring while animating */}
        {animating && (
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            border: '2px solid #0ff',
            animation: 'aria-pulse 1s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Audio-only fallback */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Status label */}
      <span style={{ fontSize: 11, color: animating ? '#0ff' : '#0558', letterSpacing: 2, textTransform: 'uppercase' }}>
        {animating ? '● speaking' : 'aria'}
      </span>

      <style>{`
        @keyframes aria-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 0;   transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
