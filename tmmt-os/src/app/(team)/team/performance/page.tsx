import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/auth-portals";
import { hasEntitlement } from "@/lib/access/resolve";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { KpiWeekForm } from "@/components/marketing-kpi/kpi-week-form";
import { GhlKpiSyncButton } from "@/components/marketing-kpi/ghl-kpi-sync-button";
import { listMarketingKpiWeeks, weekStartMonday } from "@/lib/marketing-kpi/queries";
import {
  MARKETING_KPI_TARGETS,
  type MarketingKpiMetricKey,
} from "@/lib/marketing-kpi/types";
import { TrendingUp, Users, Phone, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

function pctOfTarget(value: number, target: number): string {
  if (target <= 0) return "—";
  return `${Math.round((value / target) * 100)}% of M1 target`;
}

export default async function TeamPerformancePage() {
  const access = await requirePortal("team");
  if (!hasEntitlement(access, "team_performance")) {
    redirect("/portals?error=entitlement");
  }

  const me = await getCurrentUser();
  const canEdit = me?.role === "admin" || me?.role === "internal_team";
  const weeks = await listMarketingKpiWeeks(8);
  const latest = weeks[0];
  const defaultWeek = weekStartMonday();

  const metrics: { key: MarketingKpiMetricKey; label: string; icon: ReactNode }[] = [
    { key: "new_subscribers", label: "New $97 subs", icon: <DollarSign className="h-5 w-5" /> },
    { key: "calls_booked", label: "Calls booked", icon: <Phone className="h-5 w-5" /> },
    { key: "dm_started", label: "DMs started", icon: <Users className="h-5 w-5" /> },
    { key: "followers", label: "New followers", icon: <TrendingUp className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Marketing performance"
        description="Weekly KPI dashboard — organic-first rollout. Month 1 targets shown; aim for Month 3 by week 12."
        action={
          canEdit ? (
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              <GhlKpiSyncButton
                weekStart={defaultWeek}
                lastSyncedAt={latest?.ghl_synced_at}
              />
              <Link
                href="/internal/briefing"
                className="text-sm font-medium text-primary hover:underline"
              >
                COO briefing →
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ key, label, icon }) => {
          const value = latest?.[key] ?? 0;
          const t1 = MARKETING_KPI_TARGETS[key].month1;
          const t3 = MARKETING_KPI_TARGETS[key].month3;
          return (
            <StatCard
              key={key}
              label={label}
              value={latest ? value : "—"}
              hint={latest ? `${pctOfTarget(value, t1)} · M3 goal ${t3}/wk` : `M1 target ${t1}/wk`}
              icon={icon}
            />
          );
        })}
      </div>

      {latest?.ghl_auto && (
        <section className="surface-card space-y-2 p-5 text-sm">
          <h2 className="text-lg font-medium">Last GHL pull</h2>
          <p className="text-muted-foreground">
            Auto-filled: subscribers, strategy calls, form fills (DM proxy), and contacts synced this
            week. Followers and video views are still entered manually.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(latest.ghl_auto, null, 2)}
          </pre>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <KpiWeekForm
          defaultWeekStart={defaultWeek}
          canEdit={canEdit}
          defaults={
            latest
              ? {
                  followers: latest.followers,
                  reel_views: latest.reel_views,
                  story_views: latest.story_views,
                  dm_started: latest.dm_started,
                  calls_booked: latest.calls_booked,
                  new_subscribers: latest.new_subscribers,
                  email_list_growth: latest.email_list_growth,
                }
              : undefined
          }
        />

        <section className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-medium">Targets reference</h2>
          <p className="text-sm text-muted-foreground">
            40% proof · 30% education · 20% story · 10% offer. Day-30 launch: 50 VIP subs, ~$5k
            MRR.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">Metric</th>
                <th className="pb-2">Month 1</th>
                <th className="pb-2">Month 3</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(Object.keys(MARKETING_KPI_TARGETS) as MarketingKpiMetricKey[]).map((key) => (
                <tr key={key}>
                  <td className="py-2 capitalize">{key.replace(/_/g, " ")}</td>
                  <td className="py-2 tabular-nums">{MARKETING_KPI_TARGETS[key].month1}/wk</td>
                  <td className="py-2 tabular-nums">{MARKETING_KPI_TARGETS[key].month3}/wk</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {weeks.length > 0 && (
        <section className="surface-card space-y-3 p-5">
          <h2 className="text-lg font-medium">History</h2>
          <ul className="divide-y text-sm">
            {weeks.map((w) => (
              <li key={w.week_start} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-medium">Week {w.week_start}</span>
                <span className="text-muted-foreground">
                  {w.new_subscribers} subs · {w.calls_booked} calls · {w.followers} followers
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
