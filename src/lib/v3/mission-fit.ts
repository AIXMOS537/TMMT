/**
 * Mission fit test — gate for operators, returning team, and new parties.
 * For the people. Low overhead. Not everyone gets in.
 */
import { createClient } from '@supabase/supabase-js'

export const MAX_TMMT_OPERATORS_LIFETIME = Number(process.env.TMMT_MAX_OPERATORS ?? 100)
export const TMMT_LAUNCH_OPERATOR_CAP = Number(process.env.TMMT_LAUNCH_OPERATOR_CAP ?? 10)
export const FIT_PASS_PERCENT = Number(process.env.MISSION_FIT_PASS_PERCENT ?? 80)

export type ApplicantType =
  | 'new_operator'
  | 'returning_team'
  | 'failed_operator'
  | 'new_party'

export type FitQuestion = {
  id: string
  text: string
  weight: number
}

export const MISSION_FIT_QUESTIONS: FitQuestion[] = [
  {
    id: 'mission',
    text: 'TMMT exists for the people — learn, earn, churn toward real goals (car, business, family). I am here to serve that mission, not extract from it.',
    weight: 20,
  },
  {
    id: 'overhead',
    text: 'After initial setup, I understand this is low-overhead: I share links, the AI qualifies leads, I earn my split. I do not expect unlimited hand-holding.',
    weight: 15,
  },
  {
    id: 'integrity',
    text: 'I will never promise credit scores, approvals, or funding amounts. I protect the owner and family. Confidentiality is non-negotiable.',
    weight: 20,
  },
  {
    id: 'honesty',
    text: 'If I failed or left before, I take responsibility. I am not rejoining to repeat the same patterns.',
    weight: 15,
  },
  {
    id: 'people',
    text: 'Every lead is a human seeking a second chance. I treat them with dignity — not cattle, not a number.',
    weight: 10,
  },
  {
    id: 'structure',
    text: 'I work best with clear structure — one step at a time, visual progress, no shame if I miss a day. I am not "lazy"; I need a system that pays me back.',
    weight: 10,
  },
  {
    id: 'growth',
    text: 'I am willing to complete Operator Academy, use tracked links only, and earn before asking for more access.',
    weight: 10,
  },
]

export function scoreFitAnswers(
  answers: Record<string, number | string>,
): { score: number; passed: boolean; executiveReview: boolean } {
  let totalWeight = 0
  let earned = 0
  for (const q of MISSION_FIT_QUESTIONS) {
    totalWeight += q.weight
    const raw = answers[q.id]
    const val = typeof raw === 'number' ? raw : Number(raw)
    const clamped = Number.isFinite(val) ? Math.max(1, Math.min(5, val)) : 1
    earned += (clamped / 5) * q.weight
  }
  const score = totalWeight > 0 ? Math.round((100 * earned) / totalWeight) : 0
  const passed = score >= FIT_PASS_PERCENT
  const executiveReview =
    answers.applicant_type === 'returning_team' ||
    answers.applicant_type === 'failed_operator'
  return { score, passed, executiveReview }
}

export async function countActiveOperators(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return 0
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return (users?.users ?? []).filter((u) => u.app_metadata?.role === 'operator').length
}

export async function isOperatorCapReached(): Promise<{ blocked: boolean; reason?: string }> {
  const n = await countActiveOperators()
  if (n >= MAX_TMMT_OPERATORS_LIFETIME) {
    return { blocked: true, reason: `Lifetime cap reached (${MAX_TMMT_OPERATORS_LIFETIME})` }
  }
  if (n >= TMMT_LAUNCH_OPERATOR_CAP) {
    return { blocked: true, reason: `Launch cap reached (${TMMT_LAUNCH_OPERATOR_CAP} founding slots)` }
  }
  return { blocked: false }
}
