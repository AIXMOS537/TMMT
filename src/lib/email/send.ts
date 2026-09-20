/**
 * The outbound email lane. Draft by default; sends only when two independent
 * things are true at once.
 *
 * Nothing in this codebase could send an email before this file. That was the
 * longest-standing gap we had, and it is also why this lane starts locked:
 * a brand-new send path with no history is exactly where a mistake becomes a
 * thousand emails.
 *
 * TWO INDEPENDENT CONDITIONS to actually transmit:
 *   1. `EMAIL_LIVE === '1'` in the environment — an operator decision, made
 *      once, outside the code.
 *   2. `ownerApproved === true` on the individual call — a per-send decision.
 *
 * Either one missing means DRAFT: the message is written to the outbox and the
 * provider is never contacted. They are deliberately different kinds of switch,
 * so that flipping the env var does not silently arm every existing caller, and
 * passing ownerApproved in code does not arm anything on a machine where the
 * env var was never set. One switch is a footgun; two is a decision.
 *
 * Before either is consulted, the message goes through assertEmailAllowed().
 * A blocked message is never sent AND never drafted — writing a suppressed
 * address into an outbox is just a queue of future violations.
 *
 * The provider call goes through fetchWithTimeout, not bare fetch: an
 * outbound HTTP call with no deadline can hang a serverless invocation until
 * the platform kills it, and the caller never learns what happened.
 *
 * PROVIDER: Resend. Chosen for a real free tier (3,000/month, 100/day) that
 * needs no card, a single-endpoint HTTP API with no SDK to pin, and per-domain
 * sending so a reputation problem is contained. Swapping it means writing one
 * more `EmailProvider` — nothing above this line knows which one is in use.
 *
 * ENV VAR NAMES ONLY (values go in ~/.config/tmmt/email.env at mode 600 and in
 * Vercel; never in the repo):
 *   EMAIL_LIVE        "1" arms the lane. Anything else, including unset, is draft.
 *   EMAIL_PROVIDER    "resend" (default) — the adapter to use.
 *   RESEND_API_KEY    provider key.
 *   EMAIL_FROM        verified sender, e.g. "TMMT <hello@example.com>".
 *   EMAIL_REPLY_TO    optional.
 *   EMAIL_OUTBOX_DIR  where drafts land. Defaults to .outbox/ under cwd.
 */
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SmsType } from '../../../shared/compliance-gates/sms-gate'
import { assertEmailAllowed, type EmailOutboundReason } from './outbound-email-gate'
import { normalizeEmail } from './dnc'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

export type SendEmailArgs = EmailMessage & {
  db?: SupabaseClient | null
  phone?: string | null
  organizationId?: string | null
  vertical?: string
  type?: SmsType
  /** Per-send owner approval. Required, alongside EMAIL_LIVE=1, to transmit. */
  ownerApproved?: boolean
  now?: Date
}

export type SendEmailResult = {
  /** 'sent' only ever means the provider accepted it. */
  status: 'sent' | 'drafted' | 'blocked' | 'failed'
  reason: EmailOutboundReason | 'not_live' | 'not_approved' | 'provider_error' | 'ok'
  flags: string[]
  providerId?: string
}

export interface EmailProvider {
  name: string
  send(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }>
}

/** Resend, over plain fetch. No SDK, so there is no version to drift. */
export function resendProvider(): EmailProvider {
  return {
    name: 'resend',
    async send(msg) {
      const key = process.env.RESEND_API_KEY
      const from = process.env.EMAIL_FROM
      if (!key || !from) return { ok: false, error: 'RESEND_API_KEY or EMAIL_FROM unset' }
      try {
        const res = await fetchWithTimeout('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [msg.to],
            subject: msg.subject,
            text: msg.text,
            ...(msg.html ? { html: msg.html } : {}),
            ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
          }),
        })
        if (!res.ok) return { ok: false, error: `http ${res.status}` }
        const body = (await res.json()) as { id?: string }
        return { ok: true, id: body.id }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    },
  }
}

export function providerFor(name = process.env.EMAIL_PROVIDER ?? 'resend'): EmailProvider {
  switch (name) {
    case 'resend':
    default:
      return resendProvider()
  }
}

/** True only when the environment has armed the lane. */
export function emailLaneIsLive(): boolean {
  return process.env.EMAIL_LIVE === '1'
}

/** Append one draft to the outbox. Never touches the network. */
export async function writeToOutbox(msg: EmailMessage, meta: Record<string, unknown>): Promise<void> {
  const dir = process.env.EMAIL_OUTBOX_DIR ?? join(process.cwd(), '.outbox')
  await mkdir(dir, { recursive: true })
  const line = JSON.stringify({ ...meta, to: msg.to, subject: msg.subject, text: msg.text }) + '\n'
  await appendFile(join(dir, 'email-outbox.jsonl'), line, 'utf8')
}

export async function sendEmail(
  args: SendEmailArgs,
  provider: EmailProvider = providerFor(),
): Promise<SendEmailResult> {
  // 1. The gate, always, before anything else. A blocked message is not sent
  //    AND not drafted — an outbox full of suppressed addresses is a loaded gun.
  const decision = await assertEmailAllowed({
    db: args.db,
    email: args.to,
    phone: args.phone,
    organizationId: args.organizationId,
    vertical: args.vertical,
    type: args.type,
    ownerApproved: args.ownerApproved,
    now: args.now,
  })
  if (!decision.allowed) {
    return { status: 'blocked', reason: decision.reason, flags: decision.flags }
  }

  const msg: EmailMessage = {
    to: normalizeEmail(args.to) ?? args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  }

  // 2. Both switches, independently.
  if (!emailLaneIsLive()) {
    await writeToOutbox(msg, { at: (args.now ?? new Date()).toISOString(), reason: 'not_live', flags: decision.flags })
    return { status: 'drafted', reason: 'not_live', flags: [...decision.flags, 'draft_not_live'] }
  }
  if (args.ownerApproved !== true) {
    await writeToOutbox(msg, { at: (args.now ?? new Date()).toISOString(), reason: 'not_approved', flags: decision.flags })
    return { status: 'drafted', reason: 'not_approved', flags: [...decision.flags, 'draft_not_approved'] }
  }

  // 3. Only now does anything leave the process.
  const out = await provider.send(msg)
  if (!out.ok) {
    return { status: 'failed', reason: 'provider_error', flags: [...decision.flags, 'provider_error'] }
  }
  return { status: 'sent', reason: 'ok', flags: [...decision.flags, 'sent'], providerId: out.id }
}
