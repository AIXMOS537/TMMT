import Link from "next/link";
import { AlertCircle, FolderKanban, RefreshCw, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  pendingSync: number;
  blockedCases: number;
  openCases: number;
};

/** Thumb-friendly shortcuts for phone triage — dashboard + can reuse elsewhere */
export function MobileOpsTriage({ pendingSync, blockedCases, openCases }: Props) {
  const items = [
    {
      href: "/internal/sync",
      label: "CRM queue",
      sub: pendingSync > 0 ? `${pendingSync} waiting` : "All clear",
      icon: RefreshCw,
      urgent: pendingSync > 0,
    },
    {
      href: "/internal/cases?view=list&status=blocked",
      label: "Blocked cases",
      sub: blockedCases > 0 ? `${blockedCases} need you` : "None blocked",
      icon: AlertCircle,
      urgent: blockedCases > 0,
    },
    {
      href: "/internal/cases?view=list",
      label: "All cases",
      sub: `${openCases} open`,
      icon: FolderKanban,
      urgent: false,
    },
    {
      href: "/internal/ledger",
      label: "Finance / ledger",
      sub: "Post charges & refunds",
      icon: Wallet,
      urgent: false,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex min-h-[4.5rem] items-center gap-3 rounded-2xl border p-4 transition-all active:scale-[0.98]",
            item.urgent
              ? "border-amber-300/80 bg-amber-50/80 shadow-soft"
              : "border-border/70 bg-card/90 shadow-soft hover:border-primary/30"
          )}
        >
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              item.urgent ? "bg-amber-200/60 text-amber-900" : "bg-muted text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
