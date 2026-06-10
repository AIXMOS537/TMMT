const STOP_PATTERN = /^(stop|stopall|unsubscribe|cancel|end|quit|stop[\s-]?please|opt[\s-]?out)\s*\.?$/i

export function isOptOutMessage(body: string): boolean {
  return STOP_PATTERN.test(body.trim())
}

export function optOutAutoReply(): string {
  return "You're opted out and won't receive further messages. Reply START anytime to opt back in."
}

const START_PATTERN = /^(start|unstop|resubscribe|opt[\s-]?in)\s*\.?$/i
export function isOptInMessage(body: string): boolean {
  return START_PATTERN.test(body.trim())
}
