"use client";

import { useEffect, useState, useMemo } from "react";
import { getTimeClock } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatCard, ExportButton, ErrorBanner } from "@/components/ui";
import { Clock, Users, Timer } from "lucide-react";

type Entry = { id: string; user_id: string; user_email: string | null; clock_in: string; clock_out: string | null };

type Row = {
  employee: string;
  shifts: number;
  minutes: number;
  hours: string;
  status: string;
  lastSeen: string;
};

function minutesBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}
function fmtHours(m: number) {
  return `${(m / 60).toFixed(1)}h`;
}

export default function TimesheetsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getTimeClock()
      .then((d) => { setEntries(d as Entry[]); setLoading(false); })
      .catch(() => { setError("Failed to load timesheets."); setLoading(false); });
  };
  useEffect(load, []);

  // Roll up the last 30 days per employee.
  const rows = useMemo<Row[]>(() => {
    const now = new Date().toISOString();
    const byEmp = new Map<string, { shifts: number; minutes: number; open: boolean; last: string }>();
    for (const e of entries) {
      const key = e.user_email || e.user_id;
      const cur = byEmp.get(key) ?? { shifts: 0, minutes: 0, open: false, last: e.clock_in };
      cur.shifts += 1;
      cur.minutes += minutesBetween(e.clock_in, e.clock_out ?? now);
      if (!e.clock_out) cur.open = true;
      if (e.clock_in > cur.last) cur.last = e.clock_in;
      byEmp.set(key, cur);
    }
    return [...byEmp.entries()]
      .map(([employee, v]) => ({
        employee,
        shifts: v.shifts,
        minutes: v.minutes,
        hours: fmtHours(v.minutes),
        status: v.open ? "🟢 Clocked in" : "Clocked out",
        lastSeen: new Date(v.last).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [entries]);

  const filtered = useMemo(
    () => rows.filter((r) => !search || r.employee.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const totals = useMemo(() => ({
    people: rows.length,
    clockedIn: rows.filter((r) => r.status.startsWith("🟢")).length,
    hours: fmtHours(rows.reduce((m, r) => m + r.minutes, 0)),
  }), [rows]);

  const columns: Column<Row>[] = [
    { key: "employee", label: "Employee", render: (r) => <span className="font-medium">{r.employee}</span> },
    { key: "status", label: "Status" },
    { key: "shifts", label: "Shifts (30d)" },
    { key: "hours", label: "Hours (30d)", csvValue: (r) => (r.minutes / 60).toFixed(2) },
    { key: "lastSeen", label: "Last activity" },
  ];

  return (
    <div>
      <PageHeader
        title="Timesheets"
        description="Who's working, and hours over the last 30 days — from the time clock"
        action={<ExportButton data={filtered} columns={columns} filename="timesheets" />}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Clocked in now" value={totals.clockedIn} icon={<Clock size={20} />} />
        <StatCard label="People (30d)" value={totals.people} icon={<Users size={20} />} />
        <StatCard label="Total hours (30d)" value={totals.hours} icon={<Timer size={20} />} />
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
              placeholder="Search employee…"
              className="w-full sm:w-72 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          <DataTable columns={columns} data={filtered} emptyMessage="No time-clock activity yet. Employees check in at /clock." />
        </>
      )}
    </div>
  );
}
