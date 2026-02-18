"use client";

import { useEffect, useState } from "react";
import { getDashboardData } from "@/lib/queries";
import { Card, StatCard, StatusBadge } from "@/components/ui";
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

type DashData = Awaited<ReturnType<typeof getDashboardData>>;

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    getDashboardData().then(setData);
  }, []);

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
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">TMMT Rentals overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Fleet Vehicles" value={data.fleet.total} icon={<Car size={20} />} trend={`${data.fleet.available} available · ${data.fleet.rented} rented`} />
        <StatCard label="Incoming Leads" value={data.leads.total} icon={<UserPlus size={20} />} trend={`${data.leads.new} new · ${data.leads.qualified} qualified`} />
        <StatCard label="Active Customers" value={data.customers.active} icon={<Users size={20} />} trend={`${data.customers.total} total in system`} />
        <StatCard label="Open Tickets" value={data.tickets.open} icon={<AlertTriangle size={20} />} trend={`${data.tickets.total} total tickets`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Background Checks" value={data.bgChecks.total} icon={<ShieldCheck size={20} />} trend={`${data.bgChecks.pending} pending review`} />
        <StatCard label="Waitlist" value={data.waitlist} icon={<Clock size={20} />} />
        <StatCard label="Payments" value={data.payments.total} icon={<CreditCard size={20} />} trend={`${data.payments.overdue} overdue`} />
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
