"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getPayments } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatCard, ErrorBanner, Card } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  getMoneyEvents,
  summarizeMoney,
  summarizeByCategory,
  type MoneyEvent,
  type CategoryBreakdown,
} from "@/lib/money-meter";
import { revenueSummary } from "@/lib/revenue";
import { ArrowDownCircle, ArrowUpCircle, PiggyBank, Gift, Scale } from "lucide-react";

/**
 * Money Meter — one unified view of every dollar the platform touches, like
 * OmniRouter's live meter but for the whole business. Collected comes from the
 * payments ledger (the revenue source of truth); Used + Saved come from the
 * money_meter_events ledger. Owner + family usage is recorded but free forever.
 */
export default function MoneyMeterPage() {
  const [events, setEvents] = useState<MoneyEvent[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getMoneyEvents(supabase), getPayments()])
      .then(([ev, pay]) => {
        setEvents(ev);
        setPayments(pay as Record<string, unknown>[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load the money meter.");
        setLoading(false);
      });
  };
  useEffect(load, []);

  // Used + saved come from the meter ledger; collected comes from payments so we
  // never double-count revenue that already lives in customer_payments.
  const meter = useMemo(() => summarizeMoney(events), [events]);
  const rev = useMemo(() => revenueSummary(payments), [payments]);
  const byCategory = useMemo(() => summarizeByCategory(events), [events]);

  const collected = rev.collectedAllTime;
  const net = collected - meter.usedBillable;

  const categoryColumns: Column<CategoryBreakdown>[] = [
    { key: "category", label: "Category", render: (r) => <span className="font-mono text-sm">{r.category}</span> },
    { key: "usedBillable", label: "Used (billed)", render: (r) => formatCurrency(r.usedBillable), csvValue: (r) => r.usedBillable },
    { key: "usedAll", label: "Used (all)", render: (r) => formatCurrency(r.usedAll), csvValue: (r) => r.usedAll },
    { key: "saved", label: "Saved", render: (r) => formatCurrency(r.saved), csvValue: (r) => r.saved },
  ];

  return (
    <div>
      <PageHeader
        title="Money Meter"
        description="Every dollar used, saved, and collected — across everything AIXMOS builds. Owner + family: free forever."
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Collected (all time)" value={formatCurrency(collected)} icon={<ArrowDownCircle size={20} />} trend="money in — from payments ledger" />
            <StatCard label="Used" value={formatCurrency(meter.usedBillable)} icon={<ArrowUpCircle size={20} />} trend="billable cost out (AI, SMS, tools)" />
            <StatCard label="Saved" value={formatCurrency(meter.saved)} icon={<PiggyBank size={20} />} trend="avoided — local brain vs cloud" />
            <StatCard label="Net" value={formatCurrency(net)} icon={<Scale size={20} />} trend="collected − used" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StatCard
              label="Free forever (owner + family)"
              value={formatCurrency(meter.freeForeverValue)}
              icon={<Gift size={20} />}
              trend="usage recorded but never billed to you"
            />
            <StatCard
              label="Outstanding + overdue"
              value={formatCurrency(rev.outstanding + rev.overdue)}
              icon={<ArrowDownCircle size={20} />}
              trend="invoiced, not yet collected"
            />
          </div>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">By category</h2>
            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                No metered usage yet. As the AI, SMS, and billing paths run, used and saved dollars land here.
              </p>
            ) : (
              <DataTable data={byCategory} columns={categoryColumns} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
