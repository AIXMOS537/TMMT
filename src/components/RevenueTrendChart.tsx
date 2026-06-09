"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { MonthlyRevenue } from "@/lib/revenue";
import { formatCurrency } from "@/lib/utils";

/** Collected-revenue-per-month bar chart for the revenue dashboard. */
export function RevenueTrendChart({ data }: { data: MonthlyRevenue[] }) {
  const empty = data.every((d) => d.collected === 0);
  return (
    <div className="h-64 w-full">
      {empty ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-slate-500">
          No collected revenue in this window yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-500" />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="currentColor"
              className="text-gray-500"
              width={70}
              tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
            />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v)), "Collected"]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="collected" fill="#1440C4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
