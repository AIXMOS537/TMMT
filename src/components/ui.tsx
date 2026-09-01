"use client";

import { cn, statusColor } from "@/lib/utils";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";

// ─── Badge ────────────────────────────────────────
/**
 * `tone` came from components/aixmos-ui/badge.tsx, which the (learn) face used
 * and which had no dark-mode colours at all. Merged here so there is one Badge:
 * existing callers pass className and are unaffected, tone callers get the same
 * five names they had, now legible on both grounds.
 */
const BADGE_TONES = {
  strong: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  moderate: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  weak: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  default: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  info: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        tone ? BADGE_TONES[tone] : undefined,
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Card sub-parts ───────────────────────────────
// Also from aixmos-ui. Same shapes, so the pages using them did not change —
// only the colours, which now have a dark half.

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-lg font-semibold text-gray-900 dark:text-slate-100", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{children}</p>;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-3", className)}>{children}</div>;
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(className)}>{children}</div>;
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>;
  return <Badge className={statusColor(status)}>{status}</Badge>;
}

// Clickable status badge with an inline dropdown of options. Saves on select.
export function StatusPill({
  status,
  options,
  onChange,
  disabled,
}: {
  status: string | null;
  options: string[];
  onChange: (newStatus: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-opacity",
          status ? statusColor(status) : "text-gray-400 dark:text-gray-500",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
        )}
      >
        {status || "—"}
        <span aria-hidden="true" className="text-[0.6rem] opacity-70">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 min-w-[8rem] rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1"
        >
          {options.map((opt) => (
            <li key={opt} role="option" aria-selected={opt === status}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); if (opt !== status) onChange(opt); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-slate-700",
                  opt === status ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-slate-300"
                )}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────
export function StatCard({
  label,
  value,
  icon,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{trend}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">{icon}</div>
        )}
      </div>
    </Card>
  );
}

// ─── Page Header ──────────────────────────────────
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Data Table ───────────────────────────────────
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
  /** Override the value used for CSV export (defaults to row[key]). */
  csvValue?: (row: T) => string | number | boolean | null | undefined;
  /** Exclude this column from CSV export (e.g. action/icon-only columns). */
  noExport?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No records found",
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300",
                    col.className
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-400 dark:text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3 text-gray-700 dark:text-slate-300", col.className)}
                    >
                      {col.render
                        ? col.render(row)
                        : (row[col.key] as ReactNode) ?? (
                            <span className="text-gray-300 dark:text-slate-600">—</span>
                          )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── CSV Export ───────────────────────────────────
// Exports the given rows using the table's columns (honoring csvValue /
// noExport). Disabled when there's nothing to export.
export function ExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  label = "Export CSV",
}: {
  data: T[];
  columns: Column<T>[];
  filename: string;
  label?: string;
}) {
  const exportColumns = columns.filter((c) => !c.noExport);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={data.length === 0}
      onClick={() => downloadCsv(filename, data, exportColumns)}
      title={data.length === 0 ? "Nothing to export" : `Export ${data.length} rows`}
    >
      <Download size={15} />
      {label}
    </Button>
  );
}

// ─── Modal / Sheet ────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh]",
          wide ? "w-full max-w-3xl" : "w-full max-w-lg"
        )}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Form Components ──────────────────────────────
export function FormField({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition";

export const selectClass = inputClass;

// ─── Form controls ────────────────────────────────
// Ported from aixmos-ui so the (learn) face stops carrying its own set. They
// build on inputClass, so they are dark-aware for the first time.
//
// Note the prop order: the spread comes BEFORE className. In the originals it
// came after, which meant a caller passing className replaced the base styles
// outright rather than adding to them — border, padding, focus ring and all.

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
      {children}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(selectClass, className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, className)} />;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" &&
          "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        variant === "secondary" &&
          "bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600",
        variant === "danger" &&
          "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" &&
          "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Filter Bar ───────────────────────────────────
export function FilterBar({
  search,
  onSearchChange,
  placeholder = "Search...",
  children,
}: {
  search: string;
  onSearchChange: (val: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "sm:w-72")}
      />
      {children}
    </div>
  );
}

// --- Error Banner ---
export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start justify-between gap-3">
      <p>{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 dark:hover:text-red-200 shrink-0"
        >
          ×
        </button>
      )}
    </div>
  );
}
