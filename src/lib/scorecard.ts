/**
 * Operator Scorecard — "eat what you kill". Fuses two live sources:
 *  - hours worked (time_clock_entries, last 30d)
 *  - value generated (collected sales attributed via the affiliate code)
 * into one row per person, so you can see value-per-hour at a glance.
 *
 * Attribution link: a sale credits an operator when the payment's `aff:` code
 * matches the operator's email or its local-part (before the @). Set each
 * operator's checkout code to their email to make this line up.
 */
import { rollupAffiliates, type PaymentRow } from "./affiliates";

export type TimeEntry = { user_email: string | null; clock_in: string; clock_out: string | null };

export type ScoreRow = {
  person: string;
  hours: number;          // last 30d
  paidSales: number;      // attributed, collected
  revenue: number;        // attributed gross collected
  commission: number;     // owed on collected
  revPerHour: number | null;
  matched: boolean;       // sales linked to a clocked-in person vs an unmatched code
};

function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}
function localPart(email: string): string {
  return norm(email).split("@")[0];
}

/** True if an affiliate code refers to this email (exact, or the part before @). */
function codeMatchesEmail(code: string, email: string): boolean {
  const c = norm(code);
  return c === norm(email) || c === localPart(email);
}

export function buildScorecard(
  timeEntries: TimeEntry[],
  payments: PaymentRow[],
  now: Date = new Date(),
): ScoreRow[] {
  // 1) hours per person (by email)
  const nowIso = now.toISOString();
  const hoursByEmail = new Map<string, number>();
  for (const e of timeEntries) {
    if (!e.user_email) continue;
    const key = norm(e.user_email);
    const mins = minutesBetween(e.clock_in, e.clock_out ?? nowIso);
    hoursByEmail.set(key, (hoursByEmail.get(key) ?? 0) + mins / 60);
  }

  // 2) value per affiliate code
  const affiliates = rollupAffiliates(payments); // [{code, paidSales, grossCollected, commission}]
  const usedCodes = new Set<string>();

  // 3) one row per clocked-in person, attaching matched sales
  const rows: ScoreRow[] = [];
  for (const [email, hours] of hoursByEmail) {
    // A person may have sales under several codes (e.g. "jane" and "jane@x.com") — sum them all.
    const matches = affiliates.filter((a) => codeMatchesEmail(a.code, email));
    matches.forEach((m) => usedCodes.add(m.code));
    const revenue = matches.reduce((s, m) => s + m.grossCollected, 0);
    rows.push({
      person: email,
      hours: Math.round(hours * 10) / 10,
      paidSales: matches.reduce((s, m) => s + m.paidSales, 0),
      revenue,
      commission: matches.reduce((s, m) => s + m.commission, 0),
      revPerHour: hours > 0 ? Math.round((revenue / hours) * 100) / 100 : null,
      matched: matches.length > 0,
    });
  }

  // 4) sales attributed to codes that never clocked in (don't hide revenue)
  for (const a of affiliates) {
    if (usedCodes.has(a.code)) continue;
    rows.push({
      person: a.code,
      hours: 0,
      paidSales: a.paidSales,
      revenue: a.grossCollected,
      commission: a.commission,
      revPerHour: null,
      matched: false,
    });
  }

  // best producers first (revenue, then hours)
  return rows.sort((x, y) => y.revenue - x.revenue || y.hours - x.hours);
}
