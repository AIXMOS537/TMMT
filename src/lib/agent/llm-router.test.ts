import { describe, it, expect } from 'vitest'
import { pickModel, extractJson, LLMOutputSchema } from './llm-router'

describe('pickModel', () => {
  it('routes simple work to the cheap model, hard work to the strong one', () => {
    expect(pickModel('simple_route')).toBe('haiku')
    expect(pickModel('qualify')).toBe('sonnet')
    expect(pickModel('close')).toBe('sonnet')
  })
})

describe('extractJson', () => {
  it('returns bare JSON unchanged', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}')
  })
  it('strips ```json fences (local models love wrapping output)', () => {
    expect(extractJson('```json\n{"a":1}\n```').trim()).toBe('{"a":1}')
  })
  it('strips bare ``` fences', () => {
    expect(extractJson('```\n{"a":1}\n```').trim()).toBe('{"a":1}')
  })
})

describe('LLMOutputSchema', () => {
  it('accepts a well-formed agent output (same contract local + cloud must meet)', () => {
    const ok = LLMOutputSchema.safeParse({
      message: 'Hi there!',
      assessment: { B: 0.5, A: 0.5, T: 0.5, confidence: 0.6 },
      next_action: 'ask_budget',
    })
    expect(ok.success).toBe(true)
  })
  it('rejects an out-of-range assessment', () => {
    const bad = LLMOutputSchema.safeParse({
      message: 'x',
      assessment: { B: 2, A: 0, T: 0, confidence: 0 },
      next_action: 'wait',
    })
    expect(bad.success).toBe(false)
  })
})
