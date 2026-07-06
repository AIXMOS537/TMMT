"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, StatCard } from "@/components/ui";
import {
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  ArrowLeft,
  Share2,
} from "lucide-react";

type EarningsData = {
  affiliateCode: string | null;
  commission: number;
  grossCollected: number;
  paidSales: number;
  pendingSales: number;
  commissionRate: number;
  payoutNote: string;
  shareLinks: { label: string; url: string }[];
  message?: string;
};

export default function OperatorEarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/operator/earnings")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-8 text-center text-sm text-gray-500">
        Could not load earnings. Try signing in again.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/operator"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
        >
          <ArrowLeft size={20} />
        </Link>
        <PageHeader
          title="Your earnings"
          description="Learn → earn → churn. Every sale you source pays you."
        />
      </div>

      {data.message && (
        <Card className="p-4 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-200">
          {data.message}
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Commission owed"
          value={`$${data.commission.toFixed(2)}`}
          icon={<DollarSign size={18} />}
          trend={`${Math.round(data.commissionRate * 100)}% of collected sales`}
        />
        <StatCard
          label="Gross collected"
          value={`$${data.grossCollected.toFixed(2)}`}
          icon={<TrendingUp size={18} />}
          trend={`${data.paidSales} paid sale${data.paidSales === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Your code"
          value={data.affiliateCode ?? "—"}
          icon={<Share2 size={18} />}
          trend={data.payoutNote}
        />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">
          Your tracked links
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Share these like a dealership gives its sales team — one link, one CTA.
          The AI qualifies leads. You earn when they pay.
        </p>
        <ul className="space-y-3">
          {data.shareLinks.map((link) => (
            <li
              key={link.url}
              className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                  {link.label}
                </p>
                <p className="text-xs text-gray-500 truncate">{link.url}</p>
              </div>
              <button
                type="button"
                onClick={() => copy(link.url)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shrink-0"
              >
                {copied === link.url ? (
                  <>
                    <Check size={14} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 border-l-4 border-emerald-500">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          The dream car path
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
          Most racers join to get access to a car — or their dream car — without
          being hustled, stalled, or robbed. Credit gate → funding → rental/lease.
          You funnel prospects; the system handles intake, qualification, and
          checkout. Keep sharing, keep learning, keep earning.
        </p>
      </Card>
    </div>
  );
}
