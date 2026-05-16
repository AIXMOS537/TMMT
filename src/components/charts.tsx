"use client";

import { ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

function ChartWrapper({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

export function BarChartCard({
  title, data, dataKey, nameKey = "name", color = COLORS[0],
}: {
  title: string; data: { name: string; value: number }[];
  dataKey?: string; nameKey?: string; color?: string;
}) {
  return (
    <ChartWrapper title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip contentStyle={{ backgroundColor: "var(--color-slate-800, #1e293b)", border: "1px solid var(--color-slate-700, #334155)", borderRadius: "8px", color: "#e2e8f0" }} />
          <Bar dataKey={dataKey ?? "value"} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function PieChartCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <ChartWrapper title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name"
            label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: "var(--color-slate-800, #1e293b)", border: "1px solid var(--color-slate-700, #334155)", borderRadius: "8px", color: "#e2e8f0" }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function LineChartCard({
  title, data, dataKey = "value", nameKey = "name", color = COLORS[0],
}: {
  title: string; data: { name: string; value: number }[];
  dataKey?: string; nameKey?: string; color?: string;
}) {
  return (
    <ChartWrapper title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip contentStyle={{ backgroundColor: "var(--color-slate-800, #1e293b)", border: "1px solid var(--color-slate-700, #334155)", borderRadius: "8px", color: "#e2e8f0" }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
