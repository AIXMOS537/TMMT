"use client";

import { useEffect, useState, useMemo } from "react";
import { getActiveCustomers } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/app/(admin)/admin-actions";

type Cust = Record<string, unknown>;

const statusOptions = ["Active", "Removed", "Contacted"];
const repoOptions = ["Not Repossessed", "In Repossession Process", "Repossessed"];
const payFreqOptions = ["Daily", "Weekly", "3-Day"];
const ratingOptions = ["A", "B", "C"];
const ticketBalanceOptions = ["No Tickets", "Low (<$100)", "Medium ($100-$299)", "High ($300+)"];

export default function CustomersPage() {
  const [data, setData] = useState<Cust[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cust | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => { setLoading(true); setError(null); getActiveCustomers().then((d) => { setData(d as Cust[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.customer_name, r.contact_email, r.contact_phone, r.license_plate].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  }), [data, search, statusFilter]);

  const columns: Column<Cust>[] = [
    { key: "customer_name", label: "Customer", render: (r) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{r.customer_name as string || "—"}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{r.contact_email as string}</p>
      </div>
    )},
    { key: "contact_phone", label: "Phone" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "repo_status", label: "Repo", render: (r) => <StatusBadge status={r.repo_status as string} /> },
    { key: "license_plate", label: "Plate" },
    { key: "rental_start_date", label: "Start Date", render: (r) => <span className="text-sm">{formatDate(r.rental_start_date as string)}</span> },
    { key: "payment_amount", label: "Payment" },
    { key: "payment_frequency", label: "Frequency", render: (r) => <StatusBadge status={r.payment_frequency as string} /> },
    { key: "payment_reliability_rating", label: "Rating", render: (r) => {
      const rating = r.payment_reliability_rating as string;
      if (!rating) return "—";
      const colors: Record<string, string> = { A: "bg-emerald-100 text-emerald-800", B: "bg-amber-100 text-amber-800", C: "bg-red-100 text-red-800" };
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${colors[rating] || ""}`}>{rating}</span>;
    }},
    { key: "ticket_balance_status", label: "Tickets", render: (r) => <StatusBadge status={r.ticket_balance_status as string} /> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("active_customers", record);
    if (!result.success) { setError(result.error); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Active Customers" description={`${data.length} customers`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add Customer</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search customers...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); }} title={editing ? "Edit Customer" : "Add Customer"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Customer Name" required><input name="customer_name" defaultValue={editing?.customer_name as string || ""} className={inputClass} required /></FormField>
          <FormField label="Phone"><input name="contact_phone" defaultValue={editing?.contact_phone as string || ""} className={inputClass} /></FormField>
          <FormField label="Email"><input name="contact_email" type="email" defaultValue={editing?.contact_email as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="status" defaultValue={editing?.status as string || "Active"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Repo Status">
            <select name="repo_status" defaultValue={editing?.repo_status as string || "Not Repossessed"} className={selectClass}>
              {repoOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Rental Start Date"><input name="rental_start_date" type="date" defaultValue={editing?.rental_start_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Payment Amount"><input name="payment_amount" defaultValue={editing?.payment_amount as string || ""} className={inputClass} /></FormField>
          <FormField label="Payment Frequency">
            <select name="payment_frequency" defaultValue={editing?.payment_frequency as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {payFreqOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Payment Rating">
            <select name="payment_reliability_rating" defaultValue={editing?.payment_reliability_rating as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {ratingOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Ticket Balance">
            <select name="ticket_balance_status" defaultValue={editing?.ticket_balance_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {ticketBalanceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="License Plate"><input name="license_plate" defaultValue={editing?.license_plate as string || ""} className={inputClass} /></FormField>
          <FormField label="VIN"><input name="vin_number" defaultValue={editing?.vin_number as string || ""} className={inputClass} /></FormField>
          <div className="sm:col-span-2"><FormField label="Service Notes"><textarea name="service_notes" rows={3} defaultValue={editing?.service_notes as string || ""} className={inputClass} /></FormField></div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
