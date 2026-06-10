import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

export const LLMOutputSchema = z.object({
  message: z.string().min(1).max(800),
  assessment: z.object({
    B: z.number().min(0).max(1),
    A: z.number().min(0).max(1),
    T: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  next_action: z.enum([
    'ask_budget', 'ask_authority', 'ask_timing', 'ask_general',
    'send_stripe_link', 'send_cal_link', 'escalate_human', 'wait',
  ]),
})

export type LLMOutput = z.infer<typeof LLMOutputSchema>

const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
} as const

const PRICE_PER_TOKEN = {
  sonnet: { in: 3.0 / 1_000_000, out: 15.0 / 1_000_000 },
  haiku:  { in: 0.8 / 1_000_000, out: 4.0 / 1_000_000 },
} as const

export type ModelKey = keyof typeof MODELS

export interface CallArgs {
  systemPrompt: string
  userMessage: string
  model: ModelKey
  maxRetries?: number
  timeoutMs?: number
}

export class LlmTimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`LLM call exceeded ${timeoutMs}ms`)
    this.name = 'LlmTimeoutError'
  }
}

// Twilio gives webhooks ~15s before retrying. We cap each LLM call well
// under that so the route stays well within Twilio's window even if
// regeneration triggers a second/third call. 8s × 3 max calls = 24s
// worst case for the LLM phase, but typical p99 single calls are ~3s.
const DEFAULT_TIMEOUT_MS = 8_000

export interface CallResult {
  parsed: LLMOutput
  raw: string
  costUsd: number
  model: ModelKey
  inputTokens: number
  outputTokens: number
}

export async function callAgent(args: CallArgs): Promise<CallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required')
  const client = new Anthropic({ apiKey })
  const modelId = MODELS[args.model]
  const maxRetries = args.maxRetries ?? 1
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let resp: Awaited<ReturnType<typeof client.messages.create>>
    try {
      resp = await client.messages.create(
        {
          model: modelId,
          max_tokens: 600,
          system: args.systemPrompt,
          messages: [{ role: 'user', content: args.userMessage }],
        },
        { signal: controller.signal },
      )
    } catch (err) {
      clearTimeout(timer)
      if (controller.signal.aborted) {
        // Surface as a typed error so the orchestrator can fall back
        // gracefully rather than retry-and-hang.
        throw new LlmTimeoutError(timeoutMs)
      }
      throw err
    }
    clearTimeout(timer)
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('').trim()
    try {
      const payload = JSON.parse(extractJson(text))
      const parsed = LLMOutputSchema.parse(payload)
      const inT = resp.usage.input_tokens
      const outT = resp.usage.output_tokens
      const costUsd = inT * PRICE_PER_TOKEN[args.model].in + outT * PRICE_PER_TOKEN[args.model].out
      return { parsed, raw: text, costUsd, model: args.model, inputTokens: inT, outputTokens: outT }
    } catch (e) {
      lastErr = e as Error
      if (attempt === maxRetries) {
        throw new Error(`LLM output failed schema after ${attempt + 1} attempts: ${(e as Error).message}\nRaw: ${text}`)
      }
    }
  }
  throw lastErr ?? new Error('unreachable')
}

function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  return text
}

export function pickModel(intent: 'simple_route' | 'qualify' | 'close'): ModelKey {
  return intent === 'simple_route' ? 'haiku' : 'sonnet'
}
