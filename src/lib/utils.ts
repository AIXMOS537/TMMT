import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: string | null | undefined): string {
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
  if (!status) return "bg-gray-100 text-gray-700";
  const s = status.toLowerCase();
  if (["active", "available", "paid", "passed", "eligible", "verified", "completed", "signed", "resolved", "clean", "installed"].some(k => s.includes(k)))
    return "bg-emerald-100 text-emerald-800";
  if (["pending", "scheduled", "new lead", "draft", "waiting", "in progress", "open", "moderate"].some(k => s.includes(k)))
    return "bg-amber-100 text-amber-800";
  if (["rented", "qualified", "contacted"].some(k => s.includes(k)))
    return "bg-blue-100 text-blue-800";
  if (["urgent", "high", "overdue", "failed", "not eligible", "retired", "terminated", "repossessed", "closed", "critical", "missing"].some(k => s.includes(k)))
    return "bg-red-100 text-red-800";
  if (["under maintenance", "needs repair", "needs review", "needs followup", "needs cleaning"].some(k => s.includes(k)))
    return "bg-orange-100 text-orange-800";
  return "bg-gray-100 text-gray-700";
}
