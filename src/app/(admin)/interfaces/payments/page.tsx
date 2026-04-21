"use client";

import { useState, useEffect, useMemo } from "react";
import { Columns3, BarChart3, Table2 } from "lucide-react";
import { getPaymentStats } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader, StatCard, DataTable, FilterBar, ErrorBanner,
  StatusBadge, Button, FormField, inputClass, selectClass,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import { BarChartCard, PieChartCard, LineChartCard } from "@/components/charts";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { KanbanItem } from "@/components/KanbanBoard";

type Payment = Record<string, unknown>;

const STATUS_OPTIONS = ["Paid", "Pending", "Overdue"];
const METHOD_OPTIONS = ["Credit Card", "Cash", "Cashapp", "Stripe", "Zelle"];
const KANBAN_COLUMNS = STATUS_OPTIONS.map((s) => ({ key: s, label: s }));

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "kanban", label: "Kanban", icon: <Columns3 size={16} /> },
];

export default function PaymentsInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<ReturnType<typeof getPaymentStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getPaymentStats()
      .then(setStats)
      .catch(() => setError("Failed to load payments."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch = !search || [r.customer_name, r.payment_method, r.vehicle].some((v) =>
        String(v ?? "").toLowerCase().includes(search.toLowerCase())
      );
      const matchStatus = !statusFilter || r.payment_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  const kanbanItems: KanbanItem[] = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((p) => p.id && p.payment_status).map((p) => ({
      id: String(p.id), status: String(p.payment_status), ...p,
    }));
  }, [stats]);

  const columns: Column<Payment>[] = [
    { key: "customer_name", label: "Customer", render: (r) => <span className="font-medium">{String(r.customer_name ?? "—")}</span> },
    { key: "amount", label: "Amount", render: (r) => formatCurrency(Number(r.amount) || null) },
    { key: "payment_status", label: "Status", render: (r) => <StatusBadge status={r.payment_status as string} /> },
    { key: "payment_method", label: "Method" },
    { key: "last_payment_date", label: "Date", render: (r) => formatDate(r.last_payment_date as string) },
  ];

  function openDetail(item: Payment) {
    setSelected(item); setPanelOpen(true); setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.amount) record.amount = Number(record.amount);
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("customer_payments", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setPanelOpen(false); setSelected(null); load();
  }

  async function handleStatusChange(itemId: string, newStatus: string, _oldStatus?: string): Promise<boolean> {
    const result = await adminUpsert("customer_payments", { id: itemId, payment_status: newStatus });
    if (result.success) { load(); return true; }
    setError(result.error);
    return false;
  }

  async function quickStatus(status: string) {
    if (!selected?.id) return;
    setSaving(true);
    const result = await adminUpsert("customer_payments", { id: selected.id, payment_status: status });
    if (!result.success) { setError(result.error); } else { setSelected({ ...selected, payment_status: status }); load(); }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div>
      <PageHeader title="Payment Management" description="Dashboard, kanban, and table views for all payments" />
      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Collected This Month" value={formatCurrency(stats.collectedThisMonth)} />
            <StatCard label="Pending" value={formatCurrency(stats.pending)} />
            <StatCard label="Overdue" value={formatCurrency(stats.overdue)} />
            <StatCard label="Avg Payment" value={formatCurrency(stats.avgPayment)} />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <LineChartCard title="Revenue (6 Months)" data={stats.revenueOverTime} color="#10b981" />
            <BarChartCard title="Payments by Method" data={stats.byMethod} color="#8b5cf6" />
            <PieChartCard title="Status Distribution" data={stats.statusDistribution} />
          </div>
        </div>
      )}

      {activeView === "table" && (
        <>
          <FilterBar search={search} onSearchChange={setSearch} placeholder="Search payments...">
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
          onCardClick={(item) => openDetail(item as Payment)}
          renderCard={(item) => (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{String(item.customer_name ?? "—")}</p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(item.amount) || null)}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                {String(item.payment_method ?? "")} · {formatDate(item.last_payment_date as string)}
              </p>
            </div>
          )}
        />
      )}

      <DetailPanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelected(null); }}
        title={editing ? "Edit Payment" : String(selected?.customer_name ?? "Payment Details")}
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <DetailSection title="Payment Info">
              <DetailRow label="Amount" value={formatCurrency(Number(selected.amount) || null)} />
              <DetailRow label="Status" value={<StatusBadge status={selected.payment_status as string} />} />
              <DetailRow label="Method" value={String(selected.payment_method ?? "—")} />
              <DetailRow label="Date" value={formatDate(selected.last_payment_date as string)} />
            </DetailSection>
            <DetailSection title="Customer">
              <DetailRow label="Name" value={String(selected.customer_name ?? "—")} href="/customers" />
              <DetailRow label="Phone" value={String(selected.phone ?? "—")} />
            </DetailSection>
            <DetailSection title="Related">
              <DetailRow label="Vehicle" value={String(selected.vehicle ?? selected.vehicle_name ?? "—")} href="/interfaces/vehicles" />
              <DetailRow label="Contract" value={String(selected.contract ?? "—")} href="/interfaces/contracts" />
            </DetailSection>
            <div className="flex flex-wrap gap-2 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              {selected.payment_status !== "Paid" && (
                <Button size="sm" onClick={() => quickStatus("Paid")} disabled={saving}>Mark Paid</Button>
              )}
              {selected.payment_status !== "Overdue" && (
                <Button variant="danger" size="sm" onClick={() => quickStatus("Overdue")} disabled={saving}>Mark Overdue</Button>
              )}
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Customer Name"><input name="customer_name" defaultValue={String(selected.customer_name ?? "")} className={inputClass} /></FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Amount"><input name="amount" type="number" step="0.01" defaultValue={String(selected.amount ?? "")} className={inputClass} /></FormField>
              <FormField label="Payment Date"><input name="last_payment_date" type="date" defaultValue={String(selected.last_payment_date ?? "")} className={inputClass} /></FormField>
            </div>
            <FormField label="Payment Method">
              <select name="payment_method" defaultValue={String(selected.payment_method ?? "")} className={selectClass}>
                <option value="">Select method...</option>
                {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select name="payment_status" defaultValue={String(selected.payment_status ?? "")} className={selectClass}>
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
