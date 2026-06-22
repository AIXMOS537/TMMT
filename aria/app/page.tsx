'use client'
import { useState, useRef, useEffect } from 'react'
import ARIAAvatar from '@/components/ARIAAvatar'
import ARIASetup from '@/components/ARIASetup'

interface Message { role: 'user' | 'assistant'; content: string }

export default function Home() {
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [node, setNode]               = useState<string>('—')
  const [isResponding, setIsResponding] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
  const [showSetup, setShowSetup]     = useState(false)
  const [portraitChecked, setPortraitChecked] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Check portrait on mount — show setup if missing
  useEffect(() => {
    fetch('/api/avatar/portrait', { method: 'HEAD' })
      .then(r => { if (!r.ok) setShowSetup(true) })
      .catch(() => {})
      .finally(() => setPortraitChecked(true))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      const reply = data.content ?? '(no response)'
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      setNode(data.node ?? '—')
      setLastResponse(reply)
      setIsResponding(true)
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Error reaching ARIA.' }])
    }
    setLoading(false)
  }

  if (!portraitChecked) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ padding: '20px 0 12px', borderBottom: '1px solid #0ff2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: '#0ff', fontWeight: 700, letterSpacing: 4, fontSize: 18 }}>ARIA</span>
          <span style={{ color: '#0558', fontSize: 11, marginLeft: 12, letterSpacing: 2 }}>NODE ZERO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#333', fontSize: 11, letterSpacing: 1 }}>{node}</span>
          <button onClick={() => setShowSetup(s => !s)} style={{ background: 'none', border: '1px solid #222', color: '#444', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            setup
          </button>
        </div>
      </div>

      {/* Setup panel */}
      {showSetup && (
        <div style={{ padding: '16px 0' }}>
          <ARIASetup onComplete={() => { setShowSetup(false); window.location.reload() }} />
        </div>
      )}

      {/* Avatar */}
      {!showSetup && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 16px' }}>
          <ARIAAvatar
            responding={isResponding}
            responseText={lastResponse}
            onSpeechEnd={() => setIsResponding(false)}
          />
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {messages.length === 0 && !showSetup && (
          <p style={{ color: '#0ff3', textAlign: 'center', fontSize: 13, marginTop: 24, letterSpacing: 2 }}>
            ARIA is listening.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: 8,
              background: m.role === 'user' ? '#0ff1' : '#111',
              color: m.role === 'user' ? '#0ff' : '#ddd',
              border: m.role === 'user' ? '1px solid #0ff3' : '1px solid #222',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '10px 16px', border: '1px solid #222', borderRadius: 8, color: '#0ff5', fontSize: 13 }}>
              ⟳ thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 0 20px', borderTop: '1px solid #0ff2', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Message ARIA..."
          style={{
            flex: 1, background: '#0a0a0a', border: '1px solid #222', color: '#fff',
            padding: '12px 14px', borderRadius: 6, fontSize: 14, outline: 'none',
          }}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '12px 20px', background: loading ? '#111' : '#0ff', color: '#000',
            border: 'none', borderRadius: 6, cursor: loading ? 'default' : 'pointer',
            fontWeight: 700, letterSpacing: 1, fontSize: 14, opacity: !input.trim() ? 0.3 : 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}
