"use client";

import { useEffect, useState, useMemo } from "react";
import { getPayments } from "@/lib/queries";
import { PageHeader, DataTable, Column, FilterBar, ExportButton, StatCard, ErrorBanner } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { rollupAffiliates, COMMISSION_PER_SALE, type AffiliateRollup } from "@/lib/affiliates";

export default function AffiliatePayoutsPage() {
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getPayments()
      .then((d) => { setPayments(d as Record<string, unknown>[]); setLoading(false); })
      .catch(() => { setError("Failed to load data."); setLoading(false); });
  };
  useEffect(load, []);

  const rollup = useMemo(() => rollupAffiliates(payments), [payments]);
  const filtered = useMemo(
    () => rollup.filter((r) => !search || r.code.toLowerCase().includes(search.toLowerCase())),
    [rollup, search]
  );

  const totals = useMemo(
    () =>
      rollup.reduce(
        (acc, r) => ({
          affiliates: acc.affiliates + 1,
          paidSales: acc.paidSales + r.paidSales,
          grossCollected: acc.grossCollected + r.grossCollected,
          commission: acc.commission + r.commission,
        }),
        { affiliates: 0, paidSales: 0, grossCollected: 0, commission: 0 }
      ),
    [rollup]
  );

  const columns: Column<AffiliateRollup>[] = [
    { key: "code", label: "Affiliate", render: (r) => <span className="font-mono font-medium">{r.code}</span> },
    { key: "paidSales", label: "Paid Sales" },
    { key: "pendingSales", label: "Pending" },
    { key: "grossCollected", label: "Gross Collected", render: (r) => formatCurrency(r.grossCollected), csvValue: (r) => r.grossCollected },
    {
      key: "commission",
      label: "Commission Owed",
      render: (r) => <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(r.commission)}</span>,
      csvValue: (r) => r.commission,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Affiliate Payouts"
        description={`Commission accrues at ${formatCurrency(COMMISSION_PER_SALE)} per collected sale · attributed from payment records`}
        action={<ExportButton data={filtered} columns={columns} filename="affiliate-payouts" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Affiliates" value={totals.affiliates} />
        <StatCard label="Paid Sales" value={totals.paidSales} />
        <StatCard label="Gross Collected" value={formatCurrency(totals.grossCollected)} />
        <StatCard label="Commission Owed" value={formatCurrency(totals.commission)} />
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search affiliate code..." />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No affiliate-attributed sales yet. Sales are attributed when a payment carries an aff-/ref-/via- code."
        />
      )}
    </div>
  );
}
