import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getClientRentalHub } from "@/lib/client-rental/queries";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { moneyUSD, formatDate, cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/ui/status-colors";
import { LedgerLiveSync } from "@/components/ledger/ledger-live-sync";

export const dynamic = "force-dynamic";

const LEDGER_TONE: Record<string, StatusTone> = {
  deposit: "amber",
  deposit_return: "emerald",
  refund: "emerald",
  payment: "blue",
  deduction: "red",
  expense: "orange",
};

const LEDGER_LABEL: Record<string, string> = {
  deposit: "Security deposit",
  deposit_return: "Deposit return",
  refund: "Refund",
  payment: "Payment",
  deduction: "Deduction",
  expense: "Charge",
};

export default async function ClientBillingPage() {
  await requireEntitlement("billing_portal", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Profile email required.</p>;
  }

  const hub = await getClientRentalHub(me.email);
  const { entries } = hub.ledger;

  return (
    <div className="space-y-8">
      <LedgerLiveSync />
      <PageHeader
        title="Billing & deposits"
        description="Deposits held, deductions, refunds, and charges during your rental. Your team adds line items as the rental closes."
        action={
          <Link href="/client/rental" className="text-sm font-medium text-primary hover:underline">
            ← My rental
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Deposit / hold pending"
          value={moneyUSD(hub.ledger.pendingDepositCents / 100)}
          hint="May be released after return inspection"
        />
        <StatCard
          label="Refund / return pending"
          value={moneyUSD(hub.ledger.pendingRefundCents / 100)}
          accent="ring-1 ring-emerald-200/60"
        />
        <StatCard
          label="Deductions & charges"
          value={moneyUSD(hub.ledger.deductionCents / 100)}
          accent="ring-1 ring-red-200/50"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Activity</h2>
        {entries.length === 0 ? (
          <p className="surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
            No billing entries yet. After return, deposit and refund status will show here.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="surface-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={LEDGER_LABEL[e.entry_type] ?? e.entry_type}
                      tone={LEDGER_TONE[e.entry_type] ?? "slate"}
                    />
                    <span className="text-xs capitalize text-muted-foreground">{e.status}</span>
                  </div>
                  <p className="mt-1 font-medium">{e.title}</p>
                  {e.description && (
                    <p className="text-sm text-muted-foreground">{e.description}</p>
                  )}
                  {e.due_at && (
                    <p className="text-xs text-muted-foreground mt-1">Due {formatDate(e.due_at)}</p>
                  )}
                </div>
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums shrink-0",
                    e.entry_type === "deduction" || e.entry_type === "expense"
                      ? "text-red-700"
                      : "text-foreground"
                  )}
                >
                  {e.entry_type === "deduction" || e.entry_type === "expense" ? "−" : ""}
                  {moneyUSD(e.amount_cents / 100)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
