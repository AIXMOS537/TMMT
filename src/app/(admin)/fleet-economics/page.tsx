"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  StatCard,
  DataTable,
  Column,
  StatusBadge,
  ExportButton,
  ErrorBanner,
  Card,
} from "@/components/ui";
import { getFleet, getPayments, getExpenses } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";
import { Car, Gauge, DollarSign, TrendingUp } from "lucide-react";
import {
  computeFleetEconomics,
  type FleetVehicleInput,
  type RevenueInput,
  type CostInput,
  type VehicleEconomics,
} from "@/lib/fleet-economics";

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const num = (v: unknown) => Number(v) || 0;

function toVehicle(r: Row): FleetVehicleInput {
  const name =
    str(r.vehicle_name) ||
    str(r.name) ||
    [str(r.year), str(r.make), str(r.model)].filter(Boolean).join(" ").trim() ||
    str(r.id, "Unknown");
  const acq =
    num(r.acquisition_cost) ||
    num(r.purchase_price) ||
    num(r.purchase_cost) ||
    num(r.cost);
  return {
    id: str(r.id, name),
    name,
    status: str(r.vehicle_status) || str(r.status, "Unknown"),
    acquisitionCost: acq > 0 ? acq : null,
  };
}

function toRevenue(r: Row): RevenueInput {
  return {
    vehicle: str(r.vehicle) || str(r.vehicle_name, "Unknown"),
    amount: num(r.amount),
    counts: str(r.payment_status) === "Paid",
  };
}

function toCost(r: Row): CostInput {
  return {
    vehicle: str(r.vehicle) || str(r.vehicle_name) || null,
    amount: num(r.amount) || num(r.cost),
  };
}

export default function FleetEconomicsPage() {
  const [fleet, setFleet] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getFleet(), getPayments(), getExpenses()])
      .then(([f, p, x]) => {
        setFleet(f as Row[]);
        setPayments(p as Row[]);
        setExpenses(x as Row[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load fleet economics data.");
        setLoading(false);
      });
  }, []);

  const econ = useMemo(
    () =>
      computeFleetEconomics(
        fleet.map(toVehicle),
        payments.map(toRevenue),
        expenses.map(toCost)
      ),
    [fleet, payments, expenses]
  );

  const maxRevenue = Math.max(1, ...econ.perVehicle.map((v) => v.revenue));

  const columns: Column<VehicleEconomics>[] = [
    {
      key: "name",
      label: "Vehicle",
      render: (r) => (
        <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
      ),
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "revenue",
      label: "Revenue",
      render: (r) => <span>{formatCurrency(r.revenue)}</span>,
      csvValue: (r) => r.revenue,
    },
    {
      key: "cost",
      label: "Cost",
      render: (r) => <span>{formatCurrency(r.cost)}</span>,
      csvValue: (r) => r.cost,
    },
    {
      key: "net",
      label: "Net",
      render: (r) => (
        <span className={r.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
          {formatCurrency(r.net)}
        </span>
      ),
      csvValue: (r) => r.net,
    },
    {
      key: "roiPct",
      label: "ROI",
      render: (r) => <span>{r.roiPct == null ? "—" : `${r.roiPct}%`}</span>,
      csvValue: (r) => (r.roiPct == null ? "" : r.roiPct),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fleet Economics"
        description="Utilization, revenue per vehicle, cost, and ROI across the fleet"
        action={<ExportButton data={econ.perVehicle} columns={columns} filename="fleet-economics" />}
      />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Utilization"
              value={`${econ.utilizationPct}%`}
              icon={<Gauge size={20} />}
              trend={`${econ.rented}/${econ.fleetSize} on rent · ${econ.operationalUtilizationPct}% of rentable`}
            />
            <StatCard
              label="Total revenue (collected)"
              value={formatCurrency(econ.totalRevenue)}
              icon={<DollarSign size={20} />}
              trend={`${formatCurrency(econ.avgRevenuePerVehicle)}/vehicle avg`}
            />
            <StatCard
              label="Net after costs"
              value={formatCurrency(econ.netProfit)}
              icon={<TrendingUp size={20} />}
              trend={`${formatCurrency(econ.totalCost)} in costs`}
            />
            <StatCard
              label="Fleet ROI"
              value={econ.fleetRoiPct == null ? "—" : `${econ.fleetRoiPct}%`}
              icon={<Car size={20} />}
              trend={
                econ.fleetRoiPct == null
                  ? "add acquisition cost to see ROI"
                  : `${econ.maintenance + econ.needsRepair} out of service`
              }
            />
          </div>

          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              Revenue by vehicle (top earners)
            </h3>
            <div className="space-y-2">
              {econ.perVehicle.slice(0, 12).map((v) => (
                <div key={v.name} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm text-gray-600 dark:text-gray-300">{v.name}</div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded h-4 overflow-hidden">
                    <div
                      className="h-full bg-blue-500/80 rounded"
                      style={{ width: `${(v.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm tabular-nums">{formatCurrency(v.revenue)}</div>
                </div>
              ))}
              {econ.perVehicle.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No fleet data yet.</p>
              )}
            </div>
          </Card>

          <div className="mt-6">
            <DataTable columns={columns} data={econ.perVehicle} />
          </div>
        </>
      )}
    </div>
  );
}
