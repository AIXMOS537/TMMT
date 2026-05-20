import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function moneyUSD(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export const formatCurrency = moneyUSD;

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusColor(status: string | null): string {
  if (!status) return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  const s = status.toLowerCase();
  if (
    ["active", "available", "paid", "passed", "eligible", "verified", "completed", "signed", "resolved"].some(
      (k) => s.includes(k)
    )
  )
    return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300";
  if (["pending", "scheduled", "new lead", "draft", "open", "moderate"].some((k) => s.includes(k)))
    return "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300";
  if (["rented", "qualified", "contacted"].some((k) => s.includes(k)))
    return "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300";
  if (["urgent", "overdue", "failed", "terminated", "critical"].some((k) => s.includes(k)))
    return "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300";
  if (["under maintenance", "needs repair"].some((k) => s.includes(k)))
    return "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300";
  return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
}
