import { describe, it, expect } from 'vitest'
import {
  nextStatusForDecision,
  assertSendable,
  ApprovalTransitionError,
  type GatedStatus,
} from './approval-store'

describe('approval-store state machine', () => {
  it('approves and rejects a pending action', () => {
    expect(nextStatusForDecision('pending', 'approve')).toBe('approved')
    expect(nextStatusForDecision('pending', 'reject')).toBe('rejected')
  })

  it('refuses to decide a non-pending action', () => {
    const settled: GatedStatus[] = ['approved', 'rejected', 'sent', 'failed']
    for (const s of settled) {
      expect(() => nextStatusForDecision(s, 'approve')).toThrow(ApprovalTransitionError)
      expect(() => nextStatusForDecision(s, 'reject')).toThrow(ApprovalTransitionError)
    }
  })

  it('only allows sending an approved action', () => {
    expect(() => assertSendable('approved')).not.toThrow()
    for (const s of ['pending', 'rejected', 'sent', 'failed'] as GatedStatus[]) {
      expect(() => assertSendable(s)).toThrow(ApprovalTransitionError)
    }
  })
})
