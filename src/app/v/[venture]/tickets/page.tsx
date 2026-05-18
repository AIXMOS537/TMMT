"use client";

import { useEffect, useState, useMemo } from "react";
import { getTickets } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/lib/admin-actions";

type Ticket = Record<string, unknown>;

const statusOptions = ["Open", "In Progress", "Resolved", "Closed", "On Hold", "Canceled"];
const priorityOptions = ["Urgent", "High", "Medium", "Low"];
const violationOptions = ["Speeding", "Parking", "Tolls", "Others"];

export default function TicketsPage() {
  const [data, setData] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); setError(null); getTickets().then((d) => { setData(d as Ticket[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.requested_by_customer, r.citation_number, r.description_issue_details].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchPriority = !priorityFilter || r.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }), [data, search, statusFilter, priorityFilter]);

  const columns: Column<Ticket>[] = [
    { key: "ticket_id", label: "ID", render: (r) => <span className="font-mono text-sm font-bold">#{r.ticket_id as number}</span> },
    { key: "requested_by_customer", label: "Customer" },
    { key: "violation_type", label: "Violation", render: (r) => <StatusBadge status={r.violation_type as string} /> },
    { key: "citation_number", label: "Citation #" },
    { key: "amount", label: "Amount", render: (r) => <span className="font-semibold">{formatCurrency(r.amount as number)}</span> },
    { key: "priority", label: "Priority", render: (r) => <StatusBadge status={r.priority as string} /> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "date_created", label: "Created", render: (r) => <span className="text-sm">{formatDate(r.date_created as string)}</span> },
    { key: "follow_up_date", label: "Follow-up", render: (r) => <span className="text-sm">{formatDate(r.follow_up_date as string)}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.amount) record.amount = Number(record.amount);
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("tickets", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Tickets" description={`${data.length} tickets`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Ticket</Button>} />

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {statusOptions.map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)} className={`p-3 rounded-xl border text-center transition-all ${statusFilter === s ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30" : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.filter((r) => r.status === s).length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{s}</p>
          </button>
        ))}
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search tickets...">
        <select className={selectClass + " sm:w-40"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectClass + " sm:w-40"} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Ticket" : "New Ticket"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Customer"><input name="requested_by_customer" defaultValue={editing?.requested_by_customer as string || ""} className={inputClass} /></FormField>
          <FormField label="Citation #"><input name="citation_number" defaultValue={editing?.citation_number as string || ""} className={inputClass} /></FormField>
          <FormField label="Violation Type">
            <select name="violation_type" defaultValue={editing?.violation_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {violationOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Amount"><input name="amount" type="number" step="0.01" defaultValue={editing?.amount as number || ""} className={inputClass} /></FormField>
          <FormField label="Priority">
            <select name="priority" defaultValue={editing?.priority as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select name="status" defaultValue={editing?.status as string || "Open"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Date Created"><input name="date_created" type="date" defaultValue={editing?.date_created as string || ""} className={inputClass} /></FormField>
          <FormField label="Follow-up Date"><input name="follow_up_date" type="date" defaultValue={editing?.follow_up_date as string || ""} className={inputClass} /></FormField>
          <FormField label="If 'Others', specify type"><input name="if_selected_others_specify_violation_type" defaultValue={editing?.if_selected_others_specify_violation_type as string || ""} className={inputClass} /></FormField>
          <FormField label="Date Closed"><input name="date_closed" type="date" defaultValue={editing?.date_closed as string || ""} className={inputClass} /></FormField>
          <div className="sm:col-span-2"><FormField label="Description / Issue Details"><textarea name="description_issue_details" rows={3} defaultValue={editing?.description_issue_details as string || ""} className={inputClass} /></FormField></div>
          <div className="sm:col-span-2"><FormField label="Internal Notes"><textarea name="internal_notes" rows={2} defaultValue={editing?.internal_notes as string || ""} className={inputClass} /></FormField></div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
