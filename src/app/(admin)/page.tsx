"use client";

import { useEffect, useState, useMemo } from "react";
import { getDashboardData } from "@/lib/queries";
import { Card, StatCard, StatusBadge } from "@/components/ui";
import { MissionBoard } from "@/components/mission/mission-board";
import { buildOwnerMissionData } from "@/lib/mission/build";
import { formatDate } from "@/lib/utils";
import {
  Car,
  UserPlus,
  Users,
  AlertTriangle,
  CreditCard,
  Clock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useBrand } from "@/components/brand/BrandProvider";

type DashData = Awaited<ReturnType<typeof getDashboardData>>;

export default function DashboardPage() {
  const brand = useBrand();
  const [data, setData] = useState<DashData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getDashboardData().then(setData).catch(() => setLoadError(true));
  }, []);

  const mission = useMemo(() => (data ? buildOwnerMissionData(data) : null), [data]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600 dark:text-red-400">Failed to load dashboard data. Please refresh the page.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{brand.displayName} overview</p>
      </div>

      <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">Move TMMT clients into AIXMOS</p>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Membership, credit guidance, then builds — all via GoHighLevel, tagged as existing TMMT clients.
          </p>
        </div>
        <Link
          href="/upgrade"
          className="inline-flex items-center rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Open upgrade ladder
        </Link>
      </div>

      {mission && <MissionBoard data={mission} />}

      {data.paperTrail.rented >
        Math.min(data.paperTrail.contracts, data.paperTrail.handovers) && (
        <Card className="p-5 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {data.paperTrail.rented} vehicle{data.paperTrail.rented === 1 ? " is" : "s are"} out,
                with {data.paperTrail.contracts} contract{data.paperTrail.contracts === 1 ? "" : "s"} and{" "}
                {data.paperTrail.handovers} handover{data.paperTrail.handovers === 1 ? "" : "s"} on file
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                A vehicle can be marked Rented without an agreement or a handover
                record, and nothing else on this dashboard would show it. That
                gap is what gets argued about after a crash, a late return, or a
                dispute over a deposit.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
                <Link href="/interfaces/contracts" className="text-amber-900 dark:text-amber-200 underline">
                  Record a contract
                </Link>
                <Link href="/forms/handover" className="text-amber-900 dark:text-amber-200 underline">
                  Log a handover
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Fleet Vehicles" value={data.fleet.total} icon={<Car size={20} />} trend={`${data.fleet.available} available · ${data.fleet.rented} rented`} />
        <StatCard label="Incoming Leads" value={data.leads.total} icon={<UserPlus size={20} />} trend={`${data.leads.new} new · ${data.leads.qualified} qualified`} />
        <StatCard label="Active Customers" value={data.customers.active} icon={<Users size={20} />} trend={`${data.customers.total} total in system`} />
        <StatCard label="Open Tickets" value={data.tickets.open} icon={<AlertTriangle size={20} />} trend={`${data.tickets.total} total tickets`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Background Checks" value={data.bgChecks.total} icon={<ShieldCheck size={20} />} trend={`${data.bgChecks.pending} pending review`} />
        <StatCard label="Waitlist" value={data.waitlist} icon={<Clock size={20} />} />
        <StatCard label="Payments" value={data.payments.restricted ? "—" : data.payments.total} icon={<CreditCard size={20} />} trend={data.payments.restricted ? "admins only" : `${data.payments.overdue} overdue`} />
        <StatCard label="Fleet Maintenance" value={data.fleet.maintenance} icon={<Car size={20} />} trend="vehicles under maintenance" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Leads</h2>
            <Link href="/leads" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {data.recentLeads.map((lead, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {(lead.contact_name as string) || (lead.opportunity_name as string) || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{formatDate(lead.created_on as string)}</p>
                </div>
                <StatusBadge status={lead.status as string} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Tickets</h2>
            <Link href="/tickets" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {data.recentTickets.map((ticket, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    #{ticket.ticket_id as number} — {(ticket.requested_by_customer as string) || "Unassigned"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {(ticket.violation_type as string) || "General"} · {formatDate(ticket.date_created as string)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={ticket.priority as string} />
                  <StatusBadge status={ticket.status as string} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
