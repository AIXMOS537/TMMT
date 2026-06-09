"use client";

import { useEffect, useState, useMemo } from "react";
import { getTimeClock, getPayments } from "@/lib/queries";
import { buildScorecard, type ScoreRow, type TimeEntry } from "@/lib/scorecard";
import { PageHeader, DataTable, Column, StatCard, ExportButton, ErrorBanner } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { Trophy, DollarSign, Timer } from "lucide-react";

export default function ScorecardPage() {
  const [time, setTime] = useState<TimeEntry[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getTimeClock(), getPayments()])
      .then(([t, p]) => { setTime(t as TimeEntry[]); setPayments(p as Record<string, unknown>[]); setLoading(false); })
      .catch(() => { setError("Failed to load scorecard data."); setLoading(false); });
  };
  useEffect(load, []);

  const rows = useMemo(() => buildScorecard(time, payments), [time, payments]);
  const filtered = useMemo(
    () => rows.filter((r) => !search || r.person.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const hours = rows.reduce((s, r) => s + r.hours, 0);
    const top = rows.find((r) => r.revenue > 0);
    return {
      topProducer: top ? top.person : "—",
      revenue,
      hours: `${hours.toFixed(1)}h`,
      perHour: hours > 0 ? formatCurrency(revenue / hours) : "—",
    };
  }, [rows]);

  const columns: Column<ScoreRow>[] = [
    {
      key: "person",
      label: "Person",
      render: (r) => (
        <span className="font-medium">
          {r.person}
          {!r.matched && r.hours === 0 && <span className="ml-2 text-xs text-gray-400">(code, no clock-in)</span>}
        </span>
      ),
    },
    { key: "hours", label: "Hours (30d)", render: (r) => `${r.hours}h`, csvValue: (r) => r.hours },
    { key: "paidSales", label: "Sales" },
    { key: "revenue", label: "Generated", render: (r) => formatCurrency(r.revenue), csvValue: (r) => r.revenue },
    {
      key: "revPerHour",
      label: "$ / hour",
      render: (r) =>
        r.revPerHour == null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span className={`font-semibold ${r.revPerHour >= 50 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
            {formatCurrency(r.revPerHour)}
          </span>
        ),
      csvValue: (r) => r.revPerHour ?? "",
    },
    { key: "commission", label: "Commission", render: (r) => formatCurrency(r.commission), csvValue: (r) => r.commission },
  ];

  return (
    <div>
      <PageHeader
        title="Operator Scorecard"
        description="Eat what you kill — hours worked vs value generated, per person"
        action={<ExportButton data={filtered} columns={columns} filename="operator-scorecard" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Top producer" value={totals.topProducer} icon={<Trophy size={20} />} />
        <StatCard label="Value generated" value={formatCurrency(totals.revenue)} icon={<DollarSign size={20} />} />
        <StatCard label="Hours (30d)" value={totals.hours} icon={<Timer size={20} />} />
        <StatCard label="Blended $/hour" value={totals.perHour} icon={<DollarSign size={20} />} />
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <>
          <div className="mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search person…"
              className="w-full sm:w-72 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            emptyMessage="No data yet. Employees clock in at /clock; sales credit a person when the checkout carries their code (their email)."
          />
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            A sale credits a person when the payment&apos;s affiliate code matches their email (or the part before the @).
            Set each operator&apos;s checkout code to their email so it lines up.
          </p>
        </>
      )}
    </div>
  );
}
