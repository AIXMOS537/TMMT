// cn and the money/date formatters have ONE implementation, in the workspace
// package (remediation F-17). They are re-exported here so the ~40 existing
// `@/lib/utils` importers keep working unchanged.
export { cn, formatCurrency, formatCurrencyWhole, formatDate, formatDateTime } from "@aixmos/core";

export function statusColor(status: string | null): string {
  if (!status) return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  const s = status.toLowerCase();
  if (["active", "available", "paid", "passed", "eligible", "verified", "completed", "signed", "resolved", "clean", "installed"].some(k => s.includes(k)))
    return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300";
  if (["pending", "scheduled", "new lead", "draft", "waiting", "in progress", "open", "moderate"].some(k => s.includes(k)))
    return "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300";
  if (["rented", "qualified", "contacted"].some(k => s.includes(k)))
    return "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300";
  if (["urgent", "high", "overdue", "failed", "not eligible", "retired", "terminated", "repossessed", "closed", "critical", "missing"].some(k => s.includes(k)))
    return "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300";
  if (["under maintenance", "needs repair", "needs review", "needs followup", "needs cleaning"].some(k => s.includes(k)))
    return "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300";
  return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
}
