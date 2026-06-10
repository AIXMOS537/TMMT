/**
 * NANPA area code → IANA timezone mapping for major US area codes.
 * Falls back to America/New_York for unmapped codes.
 * Used by quiet-hours.ts to enforce TCPA 9pm-8am local block.
 */
const AREA_CODE_TZ: Record<string, string> = {
  // Pacific
  '206':'America/Los_Angeles','209':'America/Los_Angeles','213':'America/Los_Angeles','253':'America/Los_Angeles',
  '310':'America/Los_Angeles','323':'America/Los_Angeles','360':'America/Los_Angeles','408':'America/Los_Angeles',
  '415':'America/Los_Angeles','424':'America/Los_Angeles','425':'America/Los_Angeles','503':'America/Los_Angeles',
  '510':'America/Los_Angeles','530':'America/Los_Angeles','541':'America/Los_Angeles','559':'America/Los_Angeles',
  '562':'America/Los_Angeles','619':'America/Los_Angeles','626':'America/Los_Angeles','650':'America/Los_Angeles',
  '661':'America/Los_Angeles','707':'America/Los_Angeles','714':'America/Los_Angeles','760':'America/Los_Angeles',
  '805':'America/Los_Angeles','818':'America/Los_Angeles','831':'America/Los_Angeles','858':'America/Los_Angeles',
  '909':'America/Los_Angeles','916':'America/Los_Angeles','925':'America/Los_Angeles','949':'America/Los_Angeles',
  '971':'America/Los_Angeles','702':'America/Los_Angeles',
  // Mountain
  '303':'America/Denver','480':'America/Phoenix','505':'America/Denver','602':'America/Phoenix',
  '623':'America/Phoenix','720':'America/Denver','801':'America/Denver','928':'America/Phoenix',
  // Central
  '210':'America/Chicago','214':'America/Chicago','281':'America/Chicago','309':'America/Chicago',
  '312':'America/Chicago','314':'America/Chicago','316':'America/Chicago','405':'America/Chicago',
  '414':'America/Chicago','469':'America/Chicago','512':'America/Chicago','515':'America/Chicago',
  '630':'America/Chicago','713':'America/Chicago','773':'America/Chicago','816':'America/Chicago',
  '832':'America/Chicago','847':'America/Chicago','901':'America/Chicago','903':'America/Chicago',
  '918':'America/Chicago','936':'America/Chicago','940':'America/Chicago','956':'America/Chicago',
  '972':'America/Chicago',
  // Eastern = default (NY, NJ, FL, GA, etc. — covered by fallback)
}

export function timezoneFor(phoneE164: string): string {
  const m = phoneE164.match(/^\+1(\d{3})/)
  if (!m) return 'America/New_York'
  return AREA_CODE_TZ[m[1]] ?? 'America/New_York'
}
