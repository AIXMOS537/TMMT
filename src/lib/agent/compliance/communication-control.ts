/**
 * Deterministic communication control for an inbound customer message.
 *
 * Runs BEFORE every AI guard (licence, kill switch, LLM spend cap) and before
 * the LLM, so honouring "stop" never depends on Anthropic, the budget, the
 * licence, the kill switch or model output. No LLM is ever asked whether
 * someone opted out.
 *
 * Three outcomes besides `none`:
 *
 *  - `opt_out`  the whole message is one of the explicit keywords
 *               isOptOutMessage() already accepted (STOP, STOPALL,
 *               UNSUBSCRIBE, CANCEL, END, QUIT, "stop please", "opt out").
 *               The set is NOT widened here. Caller records suppression.
 *  - `opt_in`   the whole message is START / UNSTOP / RESUBSCRIBE / "opt in",
 *               unchanged from isOptInMessage().
 *  - `stop_like` the message is not an explicit keyword but carries a stop
 *               signal ("STOP ALL", "STOP!", "please stop", "stop texting me",
 *               "don't message me anymore", "take me off your list"). This is
 *               NOT a consent decision: the message is held for a human and
 *               gets no AI reply. It over-matches on purpose ("what time do
 *               you stop renting?" is held too); a held ordinary question
 *               costs a human reply, a missed opt-out costs a violation.
 *
 * CANCEL / END / QUIT count only as whole-message keywords. Inside a sentence
 * ("cancel my appointment", "end of the month") they are ordinary business
 * words and are not stop signals.
 */
import { isOptInMessage, isOptOutMessage } from './opt-out'

export type CommunicationControl =
  | { kind: 'opt_out' }
  | { kind: 'opt_in' }
  | { kind: 'stop_like'; signal: string }
  | { kind: 'none' }

// Apostrophes are normalised (’ -> ') before matching.
const STOP_SIGNALS: Array<[name: string, pattern: RegExp]> = [
  ['stop', /\bstop\b/i],
  ['stopall', /\bstopall\b/i],
  ['unsubscribe', /\bunsubscribe\b/i],
  ['opt_out', /\bopt[\s-]?out\b/i],
  ['revoke', /\brevoke\b/i],
  ['remove_me', /\bremove\s+me\b/i],
  ['take_me_off', /\btake\s+me\s+off\b/i],
  ['do_not_contact', /\b(?:don'?t|do\s+not|never)\s+(?:text|message|msg|contact|call|sms|email)\s+me\b/i],
  ['no_more_messages', /\bno\s+more\s+(?:texts?|messages?|msgs?|sms)\b/i],
  ['leave_me_alone', /\bleave\s+me\s+alone\b/i],
]

export function classifyCommunicationControl(body: string): CommunicationControl {
  if (isOptOutMessage(body)) return { kind: 'opt_out' }
  if (isOptInMessage(body)) return { kind: 'opt_in' }
  const text = body.replace(/[‘’]/g, "'")
  for (const [signal, pattern] of STOP_SIGNALS) {
    if (pattern.test(text)) return { kind: 'stop_like', signal }
  }
  return { kind: 'none' }
}
