"use client";

import { useEffect, useState, useMemo } from "react";
import { getExpenses } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/app/(admin)/admin-actions";

type Exp = Record<string, unknown>;

const typeOptions = ["Fuel", "Maintenance", "Registration", "Insurance", "Cleaning", "Toll", "Parking", "Other"];
const statusOptions = ["Unpaid", "Paid", "Reimbursed"];

export default function ExpensesPage() {
  const [data, setData] = useState<Exp[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); setError(null); getExpenses().then((d) => { setData(d as Exp[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.vehicle_name, r.vendor_payee, r.description, r.customer].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchType = !typeFilter || r.expense_type === typeFilter;
    return matchSearch && matchType;
  }), [data, search, typeFilter]);

  const totalAmount = useMemo(() => data.reduce((s, r) => s + (Number(r.amount) || 0), 0), [data]);

  const columns: Column<Exp>[] = [
    { key: "vehicle_name", label: "Vehicle" },
    { key: "expense_type", label: "Type", render: (r) => <StatusBadge status={r.expense_type as string} /> },
    { key: "amount", label: "Amount", render: (r) => <span className="font-semibold">{formatCurrency(r.amount as number)}</span> },
    { key: "vendor_payee", label: "Vendor/Payee" },
    { key: "expense_date", label: "Date", render: (r) => <span className="text-sm">{formatDate(r.expense_date as string)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "assignee", label: "Assignee" },
    { key: "description", label: "Description", render: (r) => <span className="text-sm truncate max-w-[200px] block">{r.description as string || "—"}</span> },
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
    const result = await adminUpsert("expenses", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Expenses" description={`${data.length} expenses · Total: ${formatCurrency(totalAmount)}`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add Expense</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search expenses...">
        <select className={selectClass + " sm:w-48"} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Expense" : "Add Expense"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Vehicle Name"><input name="vehicle_name" defaultValue={editing?.vehicle_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Expense Type">
            <select name="expense_type" defaultValue={editing?.expense_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Amount"><input name="amount" type="number" step="0.01" defaultValue={editing?.amount as number || ""} className={inputClass} /></FormField>
          <FormField label="Vendor/Payee"><input name="vendor_payee" defaultValue={editing?.vendor_payee as string || ""} className={inputClass} /></FormField>
          <FormField label="Date"><input name="expense_date" type="date" defaultValue={editing?.expense_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="status" defaultValue={editing?.status as string || "Unpaid"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Assignee"><input name="assignee" defaultValue={editing?.assignee as string || ""} className={inputClass} /></FormField>
          <FormField label="Description"><textarea name="description" rows={3} defaultValue={editing?.description as string || ""} className={inputClass} /></FormField>
          <FormField label="Notes"><textarea name="notes" rows={2} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
