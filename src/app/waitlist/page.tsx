"use client";

import { useEffect, useState, useMemo } from "react";
import { getWaitlist } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, inputClass, selectClass } from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type WL = Record<string, unknown>;

const statusOptions = ["Waiting", "Contacted", "Converted", "Not Interested", "Removed", "keep updated on new availability", "Out of radius"];
const vehicleTypes = ["Compact/Hatchback", "Sedan", "SUV", "Minivan", "Electric/Hybrid"];

export default function WaitlistPage() {
  const [data, setData] = useState<WL[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WL | null>(null);

  const load = () => { setLoading(true); getWaitlist().then((d) => { setData(d as WL[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.customer_name, r.customer_email, r.customer_phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  }), [data, search, statusFilter]);

  const columns: Column<WL>[] = [
    { key: "customer_name", label: "Customer", render: (r) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{r.customer_name as string || "—"}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{r.customer_email as string}</p>
      </div>
    )},
    { key: "customer_phone", label: "Phone" },
    { key: "vehicle_type", label: "Vehicle Type", render: (r) => <StatusBadge status={r.vehicle_type as string} /> },
    { key: "make", label: "Make" },
    { key: "model", label: "Model" },
    { key: "year", label: "Year" },
    { key: "desired_weekly_payment", label: "Desired $/wk", render: (r) => formatCurrency(r.desired_weekly_payment as number) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "date_added", label: "Added", render: (r) => <span className="text-sm">{formatDate(r.date_added as string)}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.year) record.year = Number(record.year);
    if (record.desired_weekly_payment) record.desired_weekly_payment = Number(record.desired_weekly_payment);
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("waitlist").upsert(record);
    if (error) { alert(error.message); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Waitlist" description={`${data.length} customers waiting`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add to Waitlist</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search waitlist...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Edit Waitlist Entry" : "Add to Waitlist"}>
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Customer Name" required><input name="customer_name" defaultValue={editing?.customer_name as string || ""} className={inputClass} required /></FormField>
          <FormField label="Phone"><input name="customer_phone" defaultValue={editing?.customer_phone as string || ""} className={inputClass} /></FormField>
          <FormField label="Email"><input name="customer_email" type="email" defaultValue={editing?.customer_email as string || ""} className={inputClass} /></FormField>
          <FormField label="Vehicle Type">
            <select name="vehicle_type" defaultValue={editing?.vehicle_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {vehicleTypes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Make"><input name="make" defaultValue={editing?.make as string || ""} className={inputClass} /></FormField>
            <FormField label="Model"><input name="model" defaultValue={editing?.model as string || ""} className={inputClass} /></FormField>
            <FormField label="Year"><input name="year" type="number" defaultValue={editing?.year as number || ""} className={inputClass} /></FormField>
          </div>
          <FormField label="Desired Weekly Payment"><input name="desired_weekly_payment" type="number" step="0.01" defaultValue={editing?.desired_weekly_payment as number || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="status" defaultValue={editing?.status as string || "Waiting"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Date Added"><input name="date_added" type="date" defaultValue={editing?.date_added as string || ""} className={inputClass} /></FormField>
          <FormField label="Notes"><textarea name="desired_specs_notes" rows={3} defaultValue={editing?.desired_specs_notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
