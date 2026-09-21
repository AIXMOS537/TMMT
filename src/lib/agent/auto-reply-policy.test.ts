import { describe, expect, it } from 'vitest'
import { autoReplyAuthorizedOrgs, isAutoReplyAuthorized } from './auto-reply-policy'

const TMMT = '8e651b25-e7c8-4356-af64-1716a82053b0'
const AIXMOS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

describe('auto-reply allowlist (B3_AUTO_REPLY_ORGS)', () => {
  it.each([undefined, '', '   ', ',,'])('%j authorises no organization', (raw) => {
    expect(autoReplyAuthorizedOrgs(raw).size).toBe(0)
    expect(isAutoReplyAuthorized(TMMT, raw)).toBe(false)
  })

  it('has no wildcard', () => {
    expect(isAutoReplyAuthorized(TMMT, '*')).toBe(false)
    expect(isAutoReplyAuthorized(TMMT, 'all')).toBe(false)
    expect(isAutoReplyAuthorized(TMMT, 'true')).toBe(false)
  })

  it('a house org is not eligible unless listed', () => {
    expect(isAutoReplyAuthorized(AIXMOS, TMMT)).toBe(false)
  })

  it('authorises exactly the listed ids, trimmed and case-insensitive', () => {
    const raw = ` ${TMMT.toUpperCase()} , not-a-uuid `
    expect(isAutoReplyAuthorized(TMMT, raw)).toBe(true)
    expect(autoReplyAuthorizedOrgs(raw)).toEqual(new Set([TMMT]))
  })
})
