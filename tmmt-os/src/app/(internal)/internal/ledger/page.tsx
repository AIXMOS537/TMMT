import { requireRole } from "@/lib/auth";
import { listLedgerEntries, summarizeLedger } from "@/lib/ledger/queries";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { LedgerEntryForm } from "@/components/ledger/ledger-entry-form";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { LedgerLiveSync } from "@/components/ledger/ledger-live-sync";
import { moneyUSD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InternalLedgerPage() {
  await requireRole(["admin", "internal_team"]);
  const entries = await listLedgerEntries({ limit: 150 });
  const summary = summarizeLedger(entries);

  return (
    <div className="space-y-8">
      <LedgerLiveSync />
      <PageHeader
        title="Financial ledger"
        description="Single source of truth for deposits, expenses, deductions, and refunds. Posts here appear on customer billing and partner views automatically."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Open deposits" value={moneyUSD(summary.pendingDepositCents / 100)} />
        <StatCard label="Pending refunds" value={moneyUSD(summary.pendingRefundCents / 100)} />
        <StatCard label="Deductions" value={moneyUSD(summary.deductionCents / 100)} />
        <StatCard label="Expenses" value={moneyUSD(summary.expenseCents / 100)} />
      </div>

      <LedgerEntryForm sourceLabel="operations team" />
      <LedgerTable entries={entries} allowStatusUpdate />
    </div>
  );
}
