"use client";

import { useEffect, useState, useMemo } from "react";
import { getFormerCustomers } from "@/lib/queries";
import { PageHeader, DataTable, Column, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/lib/admin-actions";

type FC = Record<string, unknown>;

export default function FormerCustomersPage() {
  const [data, setData] = useState<FC[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FC | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); setError(null); getFormerCustomers().then((d) => { setData(d as FC[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => !search || [r.customer_name, r.contact_email, r.contact_phone, r.vehicle_rented].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))), [data, search]);

  const columns: Column<FC>[] = [
    { key: "customer_name", label: "Customer", render: (r) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{r.customer_name as string || "—"}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{r.contact_email as string}</p>
      </div>
    )},
    { key: "contact_phone", label: "Phone" },
    { key: "vehicle_rented", label: "Vehicle" },
    { key: "license_plate", label: "Plate" },
    { key: "rental_start_date", label: "Start", render: (r) => <span className="text-sm">{formatDate(r.rental_start_date as string)}</span> },
    { key: "rental_end_date", label: "End", render: (r) => <span className="text-sm">{formatDate(r.rental_end_date as string)}</span> },
    { key: "last_payment_date", label: "Last Payment", render: (r) => <span className="text-sm">{formatDate(r.last_payment_date as string)}</span> },
    { key: "reason_for_removal", label: "Reason", render: (r) => <span className="text-sm truncate max-w-[200px] block">{r.reason_for_removal as string || "—"}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("former_customers", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Former Customers" description={`${data.length} former customers`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add Record</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search former customers..." />
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Former Customer" : "Add Former Customer"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Customer Name" required><input name="customer_name" defaultValue={editing?.customer_name as string || ""} className={inputClass} required /></FormField>
          <FormField label="Email"><input name="contact_email" type="email" defaultValue={editing?.contact_email as string || ""} className={inputClass} /></FormField>
          <FormField label="Phone"><input name="contact_phone" defaultValue={editing?.contact_phone as string || ""} className={inputClass} /></FormField>
          <FormField label="Vehicle Rented"><input name="vehicle_rented" defaultValue={editing?.vehicle_rented as string || ""} className={inputClass} /></FormField>
          <FormField label="License Plate"><input name="license_plate" defaultValue={editing?.license_plate as string || ""} className={inputClass} /></FormField>
          <FormField label="VIN"><input name="vin_number" defaultValue={editing?.vin_number as string || ""} className={inputClass} /></FormField>
          <FormField label="Start Date"><input name="rental_start_date" type="date" defaultValue={editing?.rental_start_date as string || ""} className={inputClass} /></FormField>
          <FormField label="End Date"><input name="rental_end_date" type="date" defaultValue={editing?.rental_end_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Last Payment"><input name="last_payment_date" type="date" defaultValue={editing?.last_payment_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Reason for Removal"><textarea name="reason_for_removal" rows={3} defaultValue={editing?.reason_for_removal as string || ""} className={inputClass} /></FormField>
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
