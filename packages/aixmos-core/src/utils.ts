import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money and date formatting: ONE implementation each (remediation F-17).
 *
 * Until 2026-09-08 this package and src/lib/utils.ts each defined their own
 * `formatCurrency` and `formatDate` with the same names and different output:
 * the package printed "$1,200" and "Sep 8, 2026, 2:30 PM", the app printed
 * "$1,200.00" and "Sep 8, 2026", and both were used in the same application.
 * The four behaviours are all legitimate, so all four survive — named for what
 * they print, null-safe, defined here (the package cannot import from the app)
 * and re-exported by src/lib/utils.ts. Callers pick the one they mean.
 *
 * src/lib/formatters.test.ts pins the exact output and fails if another
 * definition of these names appears anywhere else.
 */

const EM_DASH = "—";

/** "$1,234.50" — cents shown. Null/undefined → "—". */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return EM_DASH;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

/** "$1,235" — whole dollars, for summaries and product cards. Null/undefined → "—". */
export function formatCurrencyWhole(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return EM_DASH;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** "Jun 15, 2026" — date only. Empty/null → "—". */
export function formatDate(date: string | null | undefined): string {
  if (!date) return EM_DASH;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Jun 15, 2026, 2:30 PM" — date and time, for timelines and audit trails. Empty/null → "—". */
export function formatDateTime(date: string | null | undefined): string {
  if (!date) return EM_DASH;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
