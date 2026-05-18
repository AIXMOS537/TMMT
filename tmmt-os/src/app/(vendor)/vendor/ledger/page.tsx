import { requireRole } from "@/lib/auth";
import { listLedgerEntries } from "@/lib/ledger/queries";
import { PageHeader } from "@/components/page-header";
import { LedgerEntryForm } from "@/components/ledger/ledger-entry-form";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { LedgerLiveSync } from "@/components/ledger/ledger-live-sync";

export const dynamic = "force-dynamic";

export default async function VendorLedgerPage() {
  await requireRole(["vendor", "admin"]);
  const entries = await listLedgerEntries({ limit: 80 });

  return (
    <div className="space-y-8">
      <LedgerLiveSync />
      <PageHeader
        title="Partner expenses"
        description="Log costs tied to your vendor jobs. Linked customers see approved entries on their billing tab."
      />

      <LedgerEntryForm sourceLabel="vendor partner" />
      <LedgerTable entries={entries} showSource />
    </div>
  );
}
