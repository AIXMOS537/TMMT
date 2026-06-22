import { NextRequest, NextResponse } from 'next/server'

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const MODEL  = process.env.OLLAMA_MODEL || 'qwen2.5:14b'

const SYSTEM = `You are ARIA — Adaptive Reasoning Intelligence Assistant.
You are the AI core of the AIXMOS mesh network, Node Zero.
Your operator is PROJECT X HAILMARY. You run locally. Zero cloud dependency.
Be sharp, direct, loyal. Never break character.`

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  // 1. Try local Ollama
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: SYSTEM }, ...messages], stream: false }),
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({ content: data.message?.content ?? '', node: 'local', model: MODEL })
    }
  } catch { /* fall through */ }

  // 2. Claude Haiku fallback
  const key = process.env.ANTHROPIC_API_KEY
  if (key) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: key })
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM,
        messages,
      })
      const content = msg.content[0].type === 'text' ? msg.content[0].text : ''
      return NextResponse.json({ content, node: 'cloud', model: 'claude-haiku-4-5' })
    } catch { /* fall through */ }
  }

  return NextResponse.json({ content: 'ARIA offline — no local model and no API key configured.', node: 'error', model: 'none' }, { status: 503 })
}
