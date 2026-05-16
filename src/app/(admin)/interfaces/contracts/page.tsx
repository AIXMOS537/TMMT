"use client";

import { useState, useEffect, useMemo } from "react";
import { Columns3, BarChart3, Table2 } from "lucide-react";
import { getContractStats } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader, StatCard, DataTable, FilterBar, ErrorBanner,
  StatusBadge, Button, FormField, inputClass, selectClass,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import { LineChartCard, PieChartCard } from "@/components/charts";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { KanbanItem } from "@/components/KanbanBoard";

type Contract = Record<string, unknown>;

const STATUS_OPTIONS = ["Draft", "Signed", "Active", "Completed", "Terminated"];
const KANBAN_COLUMNS = STATUS_OPTIONS.map((s) => ({ key: s, label: s }));

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "kanban", label: "Kanban", icon: <Columns3 size={16} /> },
];

export default function ContractsInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<ReturnType<typeof getContractStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Contract | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getContractStats()
      .then(setStats)
      .catch(() => setError("Failed to load contracts."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch = !search || [r.customer_name, r.vehicle_name, r.contract_type].some((v) =>
        String(v ?? "").toLowerCase().includes(search.toLowerCase())
      );
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  const kanbanItems: KanbanItem[] = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((c) => c.id && c.status).map((c) => ({
      id: String(c.id), status: String(c.status), ...c,
    }));
  }, [stats]);

  const columns: Column<Contract>[] = [
    { key: "customer_name", label: "Customer", render: (r) => <span className="font-medium">{String(r.customer_name ?? "—")}</span> },
    { key: "vehicle_name", label: "Vehicle" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "start_date", label: "Start", render: (r) => formatDate(r.start_date as string) },
    { key: "end_date", label: "End", render: (r) => formatDate(r.end_date as string) },
    { key: "total_contract_amount", label: "Total", render: (r) => formatCurrency(Number(r.total_contract_amount) || null) },
  ];

  function openDetail(item: Contract) {
    setSelected(item); setPanelOpen(true); setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.base_price) record.base_price = Number(record.base_price);
    if (record.taxes_and_fees) record.taxes_and_fees = Number(record.taxes_and_fees);
    if (record.insurance_fee) record.insurance_fee = Number(record.insurance_fee);
    if (record.total_contract_amount) record.total_contract_amount = Number(record.total_contract_amount);
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("contracts", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setPanelOpen(false); setSelected(null); load();
  }

  async function handleStatusChange(itemId: string, newStatus: string, _oldStatus?: string): Promise<boolean> {
    const result = await adminUpsert("contracts", { id: itemId, status: newStatus });
    if (result.success) { load(); return true; }
    setError(result.error);
    return false;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <PageHeader title="Contract Management" description="Dashboard, kanban, and table views for all contracts" />
      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active" value={stats.active} />
            <StatCard label="Expiring This Week" value={stats.expiringThisWeek} />
            <StatCard label="Draft" value={stats.draft} />
            <StatCard label="Terminated This Month" value={stats.terminatedThisMonth} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <LineChartCard title="Contracts Signed (6 Months)" data={stats.signedOverTime} color="#10b981" />
            <PieChartCard title="Status Distribution" data={stats.statusDistribution} />
          </div>
        </div>
      )}

      {activeView === "table" && (
        <>
          <FilterBar search={search} onSearchChange={setSearch} placeholder="Search contracts...">
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
          onCardClick={(item) => openDetail(item as Contract)}
          renderCard={(item) => (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{String(item.customer_name ?? "—")}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{String(item.vehicle_name ?? "—")}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                {formatDate(item.start_date as string)} – {formatDate(item.end_date as string)}
              </p>
            </div>
          )}
        />
      )}

      <DetailPanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelected(null); }}
        title={editing ? "Edit Contract" : String(selected?.customer_name ?? "Contract Details")}
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <DetailSection title="Contract Info">
              <DetailRow label="Type" value={String(selected.contract_type ?? "—")} />
              <DetailRow label="Status" value={<StatusBadge status={selected.status as string} />} />
              <DetailRow label="Start" value={formatDate(selected.start_date as string)} />
              <DetailRow label="End" value={formatDate(selected.end_date as string)} />
              <DetailRow label="Total" value={formatCurrency(Number(selected.total_contract_amount) || null)} />
            </DetailSection>
            <DetailSection title="Customer">
              <DetailRow label="Name" value={String(selected.customer_name ?? "—")} href="/customers" />
              <DetailRow label="Phone" value={String(selected.phone ?? "—")} />
            </DetailSection>
            <DetailSection title="Vehicle">
              <DetailRow label="Vehicle" value={String(selected.vehicle_name ?? "—")} href="/interfaces/vehicles" />
              <DetailRow label="Plate" value={String(selected.license_plate ?? "—")} />
            </DetailSection>
            <div className="flex flex-wrap gap-2 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Customer Name">
              <input name="customer_name" defaultValue={String(selected.customer_name ?? "")} className={inputClass} />
            </FormField>
            <FormField label="Vehicle Name">
              <input name="vehicle_name" defaultValue={String(selected.vehicle_name ?? "")} className={inputClass} />
            </FormField>
            <FormField label="Contract Type">
              <input name="contract_type" defaultValue={String(selected.contract_type ?? "")} className={inputClass} />
            </FormField>
            <FormField label="Status">
              <select name="status" defaultValue={String(selected.status ?? "")} className={selectClass}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date"><input name="start_date" type="date" defaultValue={String(selected.start_date ?? "")} className={inputClass} /></FormField>
              <FormField label="End Date"><input name="end_date" type="date" defaultValue={String(selected.end_date ?? "")} className={inputClass} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Base Price"><input name="base_price" type="number" step="0.01" defaultValue={String(selected.base_price ?? "")} className={inputClass} /></FormField>
              <FormField label="Total Amount"><input name="total_contract_amount" type="number" step="0.01" defaultValue={String(selected.total_contract_amount ?? "")} className={inputClass} /></FormField>
            </div>
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
