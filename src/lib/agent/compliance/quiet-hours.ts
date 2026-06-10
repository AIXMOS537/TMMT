import { timezoneFor } from './area-code-timezone'

const QUIET_START_HOUR = 21  // 9 PM
const QUIET_END_HOUR = 8     // 8 AM

function hourInTz(date: Date, tz: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(date)
  )
}

export function isQuietHours(phoneE164: string, now: Date = new Date()): boolean {
  const tz = timezoneFor(phoneE164)
  const h = hourInTz(now, tz)
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR
}

export function nextSendWindow(phoneE164: string, now: Date = new Date()): Date {
  if (!isQuietHours(phoneE164, now)) return now
  const tz = timezoneFor(phoneE164)
  let candidate = new Date(now.getTime())
  // Walk forward hour-by-hour until we hit 08:00 local (max 24 iters)
  for (let i = 0; i < 24; i++) {
    candidate = new Date(candidate.getTime() + 60 * 60 * 1000)
    if (hourInTz(candidate, tz) === QUIET_END_HOUR) break
  }
  candidate.setUTCMinutes(0, 0, 0)
  return candidate
}
