"use client";

import { useEffect, useState, useMemo } from "react";
import { getTasks } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/lib/offline/desk-save";

type Task = Record<string, unknown>;

const statusOptions = ["To Do", "In Progress", "Done", "Blocked"];
const priorityOptions = ["High", "Medium", "Low"];

export default function TasksPage() {
  const [data, setData] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getTasks()
      .then((d) => { setData(d as Task[]); setLoading(false); })
      .catch(() => { setError("Failed to load tasks."); setLoading(false); });
  };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.title, r.description, r.assigned_to].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchPriority = !priorityFilter || r.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }), [data, search, statusFilter, priorityFilter]);

  const columns: Column<Task>[] = [
    { key: "title", label: "Task", render: (r) => <span className="font-medium">{r.title as string}</span> },
    { key: "priority", label: "Priority", render: (r) => <StatusBadge status={r.priority as string} /> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "assigned_to", label: "Assigned To" },
    { key: "due_date", label: "Due Date", render: (r) => <span className="text-sm">{formatDate(r.due_date as string)}</span> },
    { key: "created_at", label: "Created", render: (r) => <span className="text-sm">{formatDate(r.created_at as string)}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("tasks", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader
        title="To-Do List"
        description={`${data.length} tasks`}
        action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Task</Button>}
      />

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statusOptions.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            className={`p-3 rounded-xl border text-center transition-all ${statusFilter === s ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30" : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"}`}
          >
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.filter((r) => r.status === s).length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{s}</p>
          </button>
        ))}
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search tasks...">
        <select className={selectClass + " sm:w-40"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selectClass + " sm:w-40"} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }}
        title={editing ? "Edit Task" : "New Task"}
        wide
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <div className="sm:col-span-2">
            <FormField label="Title">
              <input name="title" required defaultValue={editing?.title as string || ""} className={inputClass} placeholder="Task title..." />
            </FormField>
          </div>
          <FormField label="Priority">
            <select name="priority" defaultValue={editing?.priority as string || "Medium"} className={selectClass}>
              {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select name="status" defaultValue={editing?.status as string || "To Do"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Assigned To">
            <input name="assigned_to" defaultValue={editing?.assigned_to as string || ""} className={inputClass} />
          </FormField>
          <FormField label="Due Date">
            <input name="due_date" type="date" defaultValue={editing?.due_date as string || ""} className={inputClass} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Description">
              <textarea name="description" rows={3} defaultValue={editing?.description as string || ""} className={inputClass} placeholder="Details, notes, or context..." />
            </FormField>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
