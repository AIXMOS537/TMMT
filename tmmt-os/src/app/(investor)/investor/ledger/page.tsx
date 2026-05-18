import { requireRole } from "@/lib/auth";
import { listLedgerEntries, summarizeLedger } from "@/lib/ledger/queries";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { LedgerEntryForm } from "@/components/ledger/ledger-entry-form";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { LedgerLiveSync } from "@/components/ledger/ledger-live-sync";
import { moneyUSD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvestorLedgerPage() {
  await requireRole(["investor", "admin"]);
  const entries = await listLedgerEntries({ limit: 150 });
  const summary = summarizeLedger(entries);

  return (
    <div className="space-y-8">
      <LedgerLiveSync />
      <PageHeader
        title="Fleet financials"
        description="Post expenses and adjustments for any renter. Customers see entries when “Show on customer billing” is checked."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Fleet expenses" value={moneyUSD(summary.expenseCents / 100)} />
        <StatCard label="Deductions" value={moneyUSD(summary.deductionCents / 100)} />
        <StatCard label="Pending refunds" value={moneyUSD(summary.pendingRefundCents / 100)} />
      </div>

      <LedgerEntryForm sourceLabel="investor" />
      <LedgerTable entries={entries} allowStatusUpdate />
    </div>
  );
}
