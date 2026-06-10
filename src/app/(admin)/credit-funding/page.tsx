"use client";

import { useEffect, useMemo, useState } from "react";
import { getCreditFundingSessions } from "@/lib/queries";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  FilterBar,
  selectClass,
  type Column,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

type Session = Record<string, unknown>;

const TIERS = ["education", "guidance", "pre_referral", "introduction"] as const;
type Tier = (typeof TIERS)[number];

const TIER_LABEL: Record<Tier, string> = {
  education: "Education",
  guidance: "Guidance",
  pre_referral: "Pre-referral",
  introduction: "Introduction",
};

function scoreBar(score: number) {
  const pct = Math.max(0, Math.min(60, score)) / 60;
  const color =
    score >= 50 ? "bg-emerald-500" : score >= 35 ? "bg-blue-500" : score >= 20 ? "bg-amber-500" : "bg-gray-400";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-700 dark:text-slate-300 w-9 text-right">{score}/60</span>
    </div>
  );
}

export default function CreditFundingPage() {
  const [data, setData] = useState<Session[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [handoffOnly, setHandoffOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getCreditFundingSessions()
      .then((d) => {
        setData(d as Session[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load sessions.");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch =
        !search ||
        [r.first_name, r.industry, r.funding_goal_type, r.entity_type, r.routing_tier]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchTier = !tierFilter || r.routing_tier === tierFilter;
      const matchHandoff = !handoffOnly || r.operator_handoff_requested === true;
      return matchSearch && matchTier && matchHandoff;
    });
  }, [data, search, tierFilter, handoffOnly]);

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = { education: 0, guidance: 0, pre_referral: 0, introduction: 0 };
    for (const r of data) {
      const t = r.routing_tier as string | null;
      if (t && t in c) c[t] += 1;
    }
    return c;
  }, [data]);

  const handoffCount = useMemo(
    () => data.filter((r) => r.operator_handoff_requested === true).length,
    [data]
  );

  const columns: Column<Session>[] = [
    {
      key: "first_name",
      label: "Lead",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {(r.first_name as string) || "—"}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {(r.industry as string) || ""}
          </p>
        </div>
      ),
    },
    {
      key: "routing_tier",
      label: "Tier",
      render: (r) => {
        const t = r.routing_tier as Tier | null;
        if (!t) return <span className="text-gray-400">—</span>;
        const label = TIER_LABEL[t] ?? t;
        const tone =
          t === "introduction"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : t === "pre_referral"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : t === "guidance"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300";
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>{label}</span>;
      },
    },
    { key: "score_total", label: "Readiness", render: (r) => scoreBar(Number(r.score_total ?? 0)) },
    { key: "entity_type", label: "Entity", render: (r) => <span className="text-sm">{(r.entity_type as string) || "—"}</span> },
    { key: "revenue_range", label: "Revenue", render: (r) => <span className="text-sm">{(r.revenue_range as string) || "—"}</span> },
    {
      key: "funding_goal_type",
      label: "Goal",
      render: (r) => <StatusBadge status={(r.funding_goal_type as string) || null} />,
    },
    {
      key: "time_horizon",
      label: "Horizon",
      render: (r) => <span className="text-sm">{(r.time_horizon as string) || "—"}</span>,
    },
    {
      key: "self_reported_score_range",
      label: "Self-reported",
      render: (r) => <span className="text-xs font-mono">{(r.self_reported_score_range as string) || "—"}</span>,
    },
    {
      key: "operator_handoff_requested",
      label: "Handoff",
      render: (r) =>
        r.operator_handoff_requested ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            Requested
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "created_at",
      label: "Submitted",
      render: (r) => <span className="text-sm">{formatDateTime(r.created_at as string)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Credit & Funding Readiness"
        description={`${data.length} session${data.length === 1 ? "" : "s"} · ${handoffCount} operator handoff${handoffCount === 1 ? "" : "s"} requested`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {TIERS.map((t) => {
          const active = tierFilter === t;
          return (
            <button
              key={t}
              onClick={() => setTierFilter(active ? "" : t)}
              className={`p-3 rounded-xl border text-center transition-all ${
                active
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30"
                  : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{tierCounts[t]}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{TIER_LABEL[t]}</p>
            </button>
          );
        })}
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search name, industry, goal...">
        <select
          className={selectClass + " sm:w-48"}
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
        >
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 px-2">
          <input
            type="checkbox"
            checked={handoffOnly}
            onChange={(e) => setHandoffOnly(e.target.checked)}
          />
          Handoff only
        </label>
      </FilterBar>

      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400 mb-4">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      <p className="mt-8 text-xs text-gray-500 dark:text-slate-500 leading-relaxed">
        Educational-only intake. Sessions are captured from <code>/forms/credit-funding-intake</code>. Self-reported score buckets only — no hard credit scores stored. See <code>CREDIT_FUNDING_OS.md</code> for routing tier definitions and <code>COMPLIANCE_DISCLAIMERS.md</code> §1 / §4 for the canonical disclosure language.
      </p>
    </div>
  );
}
