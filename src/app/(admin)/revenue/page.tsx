"use client";

import { useEffect, useState, useMemo } from "react";
import { getPayments } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatCard, ExportButton, ErrorBanner } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { revenueSummary, revenueByProduct, type ProductRevenue } from "@/lib/revenue";
import { rollupAffiliates, type AffiliateRollup } from "@/lib/affiliates";
import { DollarSign, Repeat, Hourglass, AlertTriangle } from "lucide-react";

export default function RevenueDashboardPage() {
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
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

  const summary = useMemo(() => revenueSummary(payments), [payments]);
  const byProduct = useMemo(() => revenueByProduct(payments), [payments]);
  const topAffiliates = useMemo(() => rollupAffiliates(payments).slice(0, 5), [payments]);

  const productColumns: Column<ProductRevenue>[] = [
    { key: "product", label: "Product", render: (r) => <span className="font-mono text-sm">{r.product}</span> },
    { key: "count", label: "Sales" },
    { key: "collected", label: "Collected", render: (r) => formatCurrency(r.collected), csvValue: (r) => r.collected },
  ];

  const affiliateColumns: Column<AffiliateRollup>[] = [
    { key: "code", label: "Affiliate", render: (r) => <span className="font-mono font-medium">{r.code}</span> },
    { key: "paidSales", label: "Paid Sales" },
    { key: "grossCollected", label: "Gross", render: (r) => formatCurrency(r.grossCollected), csvValue: (r) => r.grossCollected },
    { key: "commission", label: "Commission", render: (r) => formatCurrency(r.commission), csvValue: (r) => r.commission },
  ];

  return (
    <div>
      <PageHeader title="Revenue" description="Money collected, recurring, and outstanding — from the payments ledger" />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Collected this month" value={formatCurrency(summary.collectedThisMonth)} icon={<DollarSign size={20} />} trend={`${summary.salesThisMonth} sales`} />
            <StatCard label="Recurring this month" value={formatCurrency(summary.recurringThisMonth)} icon={<Repeat size={20} />} trend="membership-style revenue" />
            <StatCard label="Outstanding" value={formatCurrency(summary.outstanding)} icon={<Hourglass size={20} />} trend="invoiced, not yet collected" />
            <StatCard label="Overdue" value={formatCurrency(summary.overdue)} icon={<AlertTriangle size={20} />} trend="past due" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">Revenue by product</h2>
                <ExportButton data={byProduct} columns={productColumns} filename="revenue-by-product" />
              </div>
              <DataTable columns={productColumns} data={byProduct} emptyMessage="No collected revenue yet." />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">Top affiliates</h2>
                <ExportButton data={topAffiliates} columns={affiliateColumns} filename="top-affiliates" />
              </div>
              <DataTable columns={affiliateColumns} data={topAffiliates} emptyMessage="No affiliate-attributed sales yet." />
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400">
            All-time collected: <span className="font-semibold">{formatCurrency(summary.collectedAllTime)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
