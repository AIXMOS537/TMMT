"use client";

import { useEffect, useState, useMemo } from "react";
import { getLeads } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/app/(admin)/admin-actions";

type Lead = Record<string, unknown>;

const statusOptions = ["New Lead", "Qualified", "Contracting", "Closed", "vehicle returned", "Active customer"];
const priorityOptions = ["Urgent", "Moderate", "Requires Follow Up"];

export default function LeadsPage() {
  const [data, setData] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => { setLoading(true); setError(null); getLeads().then((d) => { setData(d as Lead[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch = !search || [r.contact_name, r.opportunity_name, r.email, r.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  // Pipeline counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    statusOptions.forEach((s) => { c[s] = data.filter((r) => r.status === s).length; });
    return c;
  }, [data]);

  const columns: Column<Lead>[] = [
    { key: "contact_name", label: "Contact", render: (r) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{r.contact_name as string || "—"}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{r.email as string}</p>
      </div>
    )},
    { key: "opportunity_name", label: "Opportunity" },
    { key: "phone", label: "Phone" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "priority_level", label: "Priority", render: (r) => <StatusBadge status={r.priority_level as string} /> },
    { key: "created_on", label: "Created", render: (r) => <span className="text-sm">{formatDate(r.created_on as string)}</span> },
    { key: "rating", label: "Rating" },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.phone) record.phone = Number(record.phone);
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("incoming_leads", record);
    if (!result.success) { setError(result.error); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader
        title="Incoming Leads"
        description={`${data.length} total leads`}
        action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Lead</Button>}
      />

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {statusOptions.map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)} className={`p-3 rounded-xl border text-center transition-all ${statusFilter === s ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30" : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"}`}>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts[s] || 0}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{s}</p>
          </button>
        ))}
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search leads...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); }} title={editing ? "Edit Lead" : "New Lead"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Contact Name" required><input name="contact_name" defaultValue={editing?.contact_name as string || ""} className={inputClass} required /></FormField>
          <FormField label="Opportunity Name"><input name="opportunity_name" defaultValue={editing?.opportunity_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Phone"><input name="phone" defaultValue={editing?.phone as string || ""} className={inputClass} /></FormField>
          <FormField label="Email"><input name="email" type="email" defaultValue={editing?.email as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="status" defaultValue={editing?.status as string || "New Lead"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Priority Level">
            <select name="priority_level" defaultValue={editing?.priority_level as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Notes"><textarea name="notes" rows={3} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save Lead</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
