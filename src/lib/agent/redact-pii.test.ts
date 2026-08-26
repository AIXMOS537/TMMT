import { describe, it, expect } from 'vitest'
import { redactPii } from './redact-pii'

describe('redactPii', () => {
  it('redacts a dashed SSN', () => {
    expect(redactPii('my ssn is 123-45-6789 call me back')).toBe(
      'my ssn is [redacted-ssn] call me back',
    )
  })

  it('redacts multiple SSNs in one string', () => {
    expect(redactPii('123-45-6789 and also 987-65-4321')).toBe(
      '[redacted-ssn] and also [redacted-ssn]',
    )
  })

  it('redacts a Luhn-valid card number, dashed or spaced', () => {
    // 4111111111111111 is the standard Luhn-valid Visa test number
    expect(redactPii('card 4111111111111111 please')).toBe('card [redacted-card] please')
    expect(redactPii('card 4111-1111-1111-1111 please')).toBe('card [redacted-card] please')
    expect(redactPii('card 4111 1111 1111 1111 please')).toBe('card [redacted-card] please')
  })

  it('does NOT redact a Luhn-invalid 16-digit number (avoids over-redacting ordinary long numbers)', () => {
    const notACard = '1234567890123456' // fails Luhn
    expect(redactPii(`order ref ${notACard}`)).toBe(`order ref ${notACard}`)
  })

  it('leaves ordinary lead conversation text untouched', () => {
    const text = 'I need funding for a rental at 123 Main St, my name is Jane Doe'
    expect(redactPii(text)).toBe(text)
  })

  it('leaves a plain phone number untouched (already redacted separately upstream)', () => {
    expect(redactPii('call me at 5551234567')).toBe('call me at 5551234567')
  })

  it('handles empty and falsy input without throwing', () => {
    expect(redactPii('')).toBe('')
  })
})
