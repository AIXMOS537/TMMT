"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, BarChart3, Table2 } from "lucide-react";
import { getAppointmentStats } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader, StatCard, DataTable, FilterBar, ErrorBanner,
  StatusBadge, Button, FormField, inputClass, selectClass,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import { BarChartCard, PieChartCard } from "@/components/charts";
import { CalendarView } from "@/components/CalendarView";
import type { CalendarEvent } from "@/components/CalendarView";

type Appointment = Record<string, unknown>;

const STATUS_OPTIONS = ["Scheduled", "Completed", "Cancelled", "No-Show"];
const TYPE_OPTIONS = ["New Customer Pickup", "Vehicle Return", "Payment", "Inspection", "Maintenance Drop-off", "Other"];

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "calendar", label: "Calendar", icon: <Calendar size={16} /> },
];

export default function AppointmentsInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAppointmentStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getAppointmentStats()
      .then(setStats)
      .catch(() => setError("Failed to load appointments."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch = !search || [r.customer_name, r.phone, r.email, r.appointment_type].some((v) =>
        String(v ?? "").toLowerCase().includes(search.toLowerCase())
      );
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    if (!stats) return [];
    return stats.all
      .filter((a) => a.appointment_date_time)
      .map((a) => ({
        id: String(a.id),
        date: new Date(String(a.appointment_date_time)),
        title: `${a.customer_name ?? "Unknown"} — ${a.appointment_type ?? ""}`,
        status: String(a.status ?? ""),
        ...a,
      }));
  }, [stats]);

  const columns: Column<Appointment>[] = [
    { key: "customer_name", label: "Customer", render: (r) => <span className="font-medium">{String(r.customer_name ?? "—")}</span> },
    { key: "appointment_type", label: "Type" },
    { key: "appointment_date_time", label: "Date/Time", render: (r) => formatDateTime(r.appointment_date_time as string) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "phone", label: "Phone" },
  ];

  function openDetail(item: Appointment) {
    setSelected(item);
    setPanelOpen(true);
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("appointments", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false);
    setPanelOpen(false);
    setSelected(null);
    load();
  }

  async function quickStatus(status: string) {
    if (!selected?.id) return;
    setSaving(true);
    const result = await adminUpsert("appointments", { id: selected.id, status });
    if (!result.success) { setError(result.error); } else { setSelected({ ...selected, status }); load(); }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Appointment Management" description="Dashboard, calendar, and table views for all appointments" />
      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Today" value={stats.today} />
            <StatCard label="This Week" value={stats.thisWeek} />
            <StatCard label="Completion Rate" value={`${stats.completionRate}%`} />
            <StatCard label="No-Show Rate" value={`${stats.noShowRate}%`} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <BarChartCard title="Appointments This Week" data={stats.perDay} />
            <PieChartCard title="Status Distribution" data={stats.statusDistribution} />
          </div>
        </div>
      )}

      {activeView === "table" && (
        <>
          <FilterBar search={search} onSearchChange={setSearch} placeholder="Search appointments...">
            <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FilterBar>
          <DataTable columns={columns} data={filtered} onRowClick={openDetail} />
        </>
      )}

      {activeView === "calendar" && (
        <CalendarView events={calendarEvents} onEventClick={(ev) => openDetail(ev as unknown as Appointment)} />
      )}

      <DetailPanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelected(null); }}
        title={editing ? "Edit Appointment" : String(selected?.customer_name ?? "Appointment Details")}
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <DetailSection title="Appointment Info">
              <DetailRow label="Date/Time" value={formatDateTime(selected.appointment_date_time as string)} />
              <DetailRow label="Type" value={String(selected.appointment_type ?? "—")} />
              <DetailRow label="Status" value={<StatusBadge status={selected.status as string} />} />
            </DetailSection>
            <DetailSection title="Customer">
              <DetailRow label="Name" value={String(selected.customer_name ?? "—")} href="/customers" />
              <DetailRow label="Phone" value={String(selected.phone ?? "—")} />
              <DetailRow label="Email" value={String(selected.email ?? "—")} />
            </DetailSection>
            <div className="flex flex-wrap gap-2 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              {selected.status !== "Completed" && (
                <Button size="sm" onClick={() => quickStatus("Completed")} disabled={saving}>Mark Completed</Button>
              )}
              {selected.status !== "No-Show" && (
                <Button variant="danger" size="sm" onClick={() => quickStatus("No-Show")} disabled={saving}>Mark No-Show</Button>
              )}
              {selected.status !== "Cancelled" && (
                <Button variant="ghost" size="sm" onClick={() => quickStatus("Cancelled")} disabled={saving}>Cancel</Button>
              )}
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Customer Name">
              <input name="customer_name" defaultValue={String(selected.customer_name ?? "")} className={inputClass} />
            </FormField>
            <FormField label="Phone">
              <input name="phone" defaultValue={String(selected.phone ?? "")} className={inputClass} />
            </FormField>
            <FormField label="Email">
              <input name="email" defaultValue={String(selected.email ?? "")} className={inputClass} />
            </FormField>
            <FormField label="Type">
              <select name="appointment_type" defaultValue={String(selected.appointment_type ?? "")} className={selectClass}>
                <option value="">Select type...</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Date/Time">
              <input name="appointment_date_time" type="datetime-local" defaultValue={selected.appointment_date_time ? String(selected.appointment_date_time).slice(0, 16) : ""} className={inputClass} />
            </FormField>
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
