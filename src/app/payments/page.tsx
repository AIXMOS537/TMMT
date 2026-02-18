"use client";

import { useEffect, useState, useMemo } from "react";
import { getPayments } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, inputClass, selectClass } from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Pay = Record<string, unknown>;

const statusOptions = ["Paid", "Pending", "Overdue"];
const methodOptions = ["Credit Card", "Cash", "Cashapp", "Stripe", "Zelle"];

export default function PaymentsPage() {
  const [data, setData] = useState<Pay[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pay | null>(null);

  const load = () => { setLoading(true); getPayments().then((d) => { setData(d as Pay[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.customer, r.customer_phone_number].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.payment_status === statusFilter;
    return matchSearch && matchStatus;
  }), [data, search, statusFilter]);

  // Summary
  const totals = useMemo(() => {
    const paid = data.filter(r => r.payment_status === "Paid").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const pending = data.filter(r => r.payment_status === "Pending").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const overdue = data.filter(r => r.payment_status === "Overdue").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { paid, pending, overdue };
  }, [data]);

  const columns: Column<Pay>[] = [
    { key: "customer", label: "Customer", render: (r) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{r.customer as string || "—"}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{r.customer_phone_number as string}</p>
      </div>
    )},
    { key: "amount", label: "Amount", render: (r) => <span className="font-semibold">{formatCurrency(r.amount as number)}</span> },
    { key: "payment_method", label: "Method", render: (r) => <StatusBadge status={r.payment_method as string} /> },
    { key: "payment_status", label: "Status", render: (r) => <StatusBadge status={r.payment_status as string} /> },
    { key: "last_payment_date", label: "Last Payment", render: (r) => <span className="text-sm">{formatDate(r.last_payment_date as string)}</span> },
    { key: "next_payment_due_date", label: "Next Due", render: (r) => <span className="text-sm">{formatDate(r.next_payment_due_date as string)}</span> },
    { key: "amount_past_due", label: "Past Due" },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.amount) record.amount = Number(record.amount);
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("customer_payments").upsert(record);
    if (error) { alert(error.message); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Customer Payments" description={`${data.length} payment records`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Record Payment</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-600 font-medium">Paid</p>
          <p className="text-2xl font-bold text-emerald-800">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-600 font-medium">Pending</p>
          <p className="text-2xl font-bold text-amber-800">{formatCurrency(totals.pending)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Overdue</p>
          <p className="text-2xl font-bold text-red-800">{formatCurrency(totals.overdue)}</p>
        </div>
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search payments...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Edit Payment" : "Record Payment"}>
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Customer" required><input name="customer" defaultValue={editing?.customer as string || ""} className={inputClass} required /></FormField>
          <FormField label="Phone"><input name="customer_phone_number" defaultValue={editing?.customer_phone_number as string || ""} className={inputClass} /></FormField>
          <FormField label="Amount"><input name="amount" type="number" step="0.01" defaultValue={editing?.amount as number || ""} className={inputClass} /></FormField>
          <FormField label="Payment Method">
            <select name="payment_method" defaultValue={editing?.payment_method as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {methodOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Payment Status">
            <select name="payment_status" defaultValue={editing?.payment_status as string || "Pending"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Last Payment Date"><input name="last_payment_date" type="date" defaultValue={editing?.last_payment_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Next Due Date"><input name="next_payment_due_date" type="date" defaultValue={editing?.next_payment_due_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Notes"><textarea name="notes" rows={3} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
