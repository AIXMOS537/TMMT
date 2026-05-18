import { StatusBadge } from "@/components/status-badge";
import { formatDate, moneyUSD, cn } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/ledger/types";
import { LEDGER_TYPE_LABEL } from "@/lib/ledger/types";
import type { StatusTone } from "@/lib/ui/status-colors";
import { MarkLedgerCompleteButton } from "./mark-ledger-complete-button";

const TYPE_TONE: Record<string, StatusTone> = {
  deposit: "amber",
  deposit_return: "emerald",
  refund: "emerald",
  payment: "blue",
  deduction: "red",
  expense: "orange",
};

const SOURCE_LABEL: Record<string, string> = {
  team: "Team",
  investor: "Investor",
  vendor: "Partner",
  system: "System",
};

export function LedgerTable({
  entries,
  showSource = true,
  allowStatusUpdate = false,
}: {
  entries: LedgerEntry[];
  showSource?: boolean;
  allowStatusUpdate?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
        No ledger entries yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {showSource && <th className="px-4 py-3 font-medium">Source</th>}
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Posted</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3">
                <p className="font-medium">{e.customer_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{e.customer_email}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  label={LEDGER_TYPE_LABEL[e.entry_type] ?? e.entry_type}
                  tone={TYPE_TONE[e.entry_type] ?? "slate"}
                />
              </td>
              <td className="px-4 py-3 max-w-xs">
                <p className="font-medium">{e.title}</p>
                {e.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                )}
              </td>
              <td
                className={cn(
                  "px-4 py-3 font-semibold tabular-nums whitespace-nowrap",
                  e.entry_type === "deduction" || e.entry_type === "expense"
                    ? "text-red-700"
                    : ""
                )}
              >
                {e.entry_type === "deduction" || e.entry_type === "expense" ? "−" : ""}
                {moneyUSD(e.amount_cents / 100)}
              </td>
              <td className="px-4 py-3">
                {allowStatusUpdate && e.status === "pending" ? (
                  <MarkLedgerCompleteButton entryId={e.id} />
                ) : (
                  <span className="capitalize text-xs">{e.status}</span>
                )}
              </td>
              {showSource && (
                <td className="px-4 py-3 text-xs">{SOURCE_LABEL[e.source] ?? e.source}</td>
              )}
              <td className="px-4 py-3 text-xs">{e.visible_to_client ? "Yes" : "Internal"}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(e.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
