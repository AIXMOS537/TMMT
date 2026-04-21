"use client";

import { useState, useEffect, useMemo } from "react";
import { Columns3, BarChart3, Table2 } from "lucide-react";
import { getVehicleStats, getMaintenance } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader, StatCard, DataTable, FilterBar, ErrorBanner,
  StatusBadge, Button, FormField, inputClass, selectClass,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import { BarChartCard, PieChartCard } from "@/components/charts";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { KanbanItem } from "@/components/KanbanBoard";

type Vehicle = Record<string, unknown>;

const STATUS_OPTIONS = ["Available", "Rented", "Under Maintenance", "Needs Repair", "Retired", "Coming Soon"];

const KANBAN_COLUMNS = [
  { key: "Available", label: "Available" },
  { key: "Rented", label: "Rented" },
  { key: "Under Maintenance", label: "Under Maintenance" },
  { key: "Needs Repair", label: "Needs Repair" },
  { key: "Retired", label: "Retired" },
];

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "kanban", label: "Kanban", icon: <Columns3 size={16} /> },
];

export default function VehiclesInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<ReturnType<typeof getVehicleStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recentMaintenance, setRecentMaintenance] = useState<Record<string, unknown>[]>([]);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getVehicleStats(), getMaintenance()])
      .then(([vStats, maint]) => {
        setStats(vStats);
        setRecentMaintenance(maint as Record<string, unknown>[]);
      })
      .catch(() => setError("Failed to load vehicles."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch = !search || [r.vehicle_name, r.vehicle_make, r.vehicle_model, r.vin, r.license_plate].some((v) =>
        String(v ?? "").toLowerCase().includes(search.toLowerCase())
      );
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  const kanbanItems: KanbanItem[] = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((v) => v.id && v.status).map((v) => ({
      id: String(v.id), status: String(v.status), ...v,
    }));
  }, [stats]);

  const vehicleMaintenance = useMemo(() => {
    if (!selected) return [];
    const name = String(selected.vehicle_name ?? "");
    return recentMaintenance
      .filter((m) => String(m.vehicle_name ?? "").toLowerCase() === name.toLowerCase())
      .slice(0, 3);
  }, [selected, recentMaintenance]);

  const columns: Column<Vehicle>[] = [
    { key: "vehicle_name", label: "Vehicle", render: (r) => <span className="font-medium">{String(r.vehicle_name ?? "—")}</span> },
    { key: "license_plate", label: "Plate" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "weekly_rate", label: "Weekly Rate", render: (r) => formatCurrency(Number(r.weekly_rate) || null) },
    { key: "color", label: "Color" },
    { key: "odometer", label: "Odometer", render: (r) => r.odometer ? Number(r.odometer).toLocaleString() : "—" },
  ];

  function openDetail(item: Vehicle) {
    setSelected(item); setPanelOpen(true); setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.year) record.year = Number(record.year);
    if (record.weekly_rate) record.weekly_rate = Number(record.weekly_rate);
    if (record.odometer) record.odometer = Number(record.odometer);
    if (record.lowest_possible_price) record.lowest_possible_price = Number(record.lowest_possible_price);
    if (record.partner_percentage) record.partner_percentage = Number(record.partner_percentage);
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("fleet", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setPanelOpen(false); setSelected(null); load();
  }

  async function handleStatusChange(itemId: string, newStatus: string, _oldStatus?: string): Promise<boolean> {
    const result = await adminUpsert("fleet", { id: itemId, status: newStatus });
    if (result.success) { load(); return true; }
    setError(result.error);
    return false;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <PageHeader title="Vehicle Management" description="Dashboard, kanban, and table views for the fleet" />
      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Total Fleet" value={stats.total} />
            <StatCard label="Available" value={stats.available} />
            <StatCard label="Rented" value={stats.rented} />
            <StatCard label="Maintenance" value={stats.underMaintenance} />
            <StatCard label="Needs Repair" value={stats.needsRepair} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <PieChartCard title="Fleet Status Distribution" data={stats.statusDistribution} />
            <BarChartCard title="Revenue per Vehicle (Top 10)" data={stats.revenuePerVehicle} color="#10b981" />
          </div>
        </div>
      )}

      {activeView === "table" && (
        <>
          <FilterBar search={search} onSearchChange={setSearch} placeholder="Search vehicles...">
            <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FilterBar>
          <DataTable columns={columns} data={filtered} onRowClick={openDetail} />
        </>
      )}

      {activeView === "kanban" && (
        <KanbanBoard
          columns={KANBAN_COLUMNS}
          items={kanbanItems}
          onStatusChange={handleStatusChange}
          onCardClick={(item) => openDetail(item as Vehicle)}
          renderCard={(item) => (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{String(item.vehicle_name ?? "—")}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{String(item.license_plate ?? "")}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{formatCurrency(Number(item.weekly_rate) || null)}/wk</p>
            </div>
          )}
        />
      )}

      <DetailPanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelected(null); }}
        title={editing ? "Edit Vehicle" : String(selected?.vehicle_name ?? "Vehicle Details")}
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <DetailSection title="Vehicle Info">
              <DetailRow label="Name" value={String(selected.vehicle_name ?? "—")} />
              <DetailRow label="Make/Model" value={`${selected.vehicle_make ?? ""} ${selected.vehicle_model ?? ""}`} />
              <DetailRow label="Year" value={String(selected.year ?? "—")} />
              <DetailRow label="VIN" value={String(selected.vin ?? "—")} />
              <DetailRow label="Plate" value={String(selected.license_plate ?? "—")} />
              <DetailRow label="Color" value={String(selected.color ?? "—")} />
              <DetailRow label="Odometer" value={selected.odometer ? Number(selected.odometer).toLocaleString() : "—"} />
              <DetailRow label="Weekly Rate" value={formatCurrency(Number(selected.weekly_rate) || null)} />
              <DetailRow label="Status" value={<StatusBadge status={selected.status as string} />} />
            </DetailSection>

            {vehicleMaintenance.length > 0 && (
              <DetailSection title="Recent Maintenance">
                {vehicleMaintenance.map((m, i) => (
                  <DetailRow key={i} label={formatDate((m.appointment_date_time as string) ?? "")} value={String(m.service_type ?? m.notes ?? "—")} />
                ))}
                <a href="/maintenance" className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">View all maintenance →</a>
              </DetailSection>
            )}

            <div className="flex flex-wrap gap-2 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Vehicle Name"><input name="vehicle_name" defaultValue={String(selected.vehicle_name ?? "")} className={inputClass} /></FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Make"><input name="vehicle_make" defaultValue={String(selected.vehicle_make ?? "")} className={inputClass} /></FormField>
              <FormField label="Model"><input name="vehicle_model" defaultValue={String(selected.vehicle_model ?? "")} className={inputClass} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Year"><input name="year" type="number" defaultValue={String(selected.year ?? "")} className={inputClass} /></FormField>
              <FormField label="Color"><input name="color" defaultValue={String(selected.color ?? "")} className={inputClass} /></FormField>
            </div>
            <FormField label="VIN"><input name="vin" defaultValue={String(selected.vin ?? "")} className={inputClass} /></FormField>
            <FormField label="License Plate"><input name="license_plate" defaultValue={String(selected.license_plate ?? "")} className={inputClass} /></FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Weekly Rate"><input name="weekly_rate" type="number" step="0.01" defaultValue={String(selected.weekly_rate ?? "")} className={inputClass} /></FormField>
              <FormField label="Odometer"><input name="odometer" type="number" defaultValue={String(selected.odometer ?? "")} className={inputClass} /></FormField>
            </div>
            <FormField label="Status">
              <select name="status" defaultValue={String(selected.status ?? "")} className={selectClass}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        )}
      </DetailPanel>
    </div>
  );
}
