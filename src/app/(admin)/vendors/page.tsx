"use client";

import { useEffect, useState, useMemo } from "react";
import { getVendors } from "@/lib/queries";
import { PageHeader, DataTable, Column, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass } from "@/components/ui";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/app/(admin)/admin-actions";

type Vendor = Record<string, unknown>;

export default function VendorsPage() {
  const [data, setData] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); setError(null); getVendors().then((d) => { setData(d as Vendor[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => !search || [r.vendor_payee, r.point_of_contact, r.email_address].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))), [data, search]);

  const columns: Column<Vendor>[] = [
    { key: "vendor_payee", label: "Vendor/Payee", render: (r) => <span className="font-medium text-gray-900 dark:text-white">{r.vendor_payee as string || "—"}</span> },
    { key: "phone_number", label: "Phone" },
    { key: "email_address", label: "Email" },
    { key: "point_of_contact", label: "Contact Person" },
    { key: "notes", label: "Notes", render: (r) => <span className="text-sm truncate max-w-[300px] block">{r.notes as string || "—"}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("shops_mechanics_cleaning", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Vendors / Shops / Mechanics" description={`${data.length} vendors`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add Vendor</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search vendors..." />
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Vendor" : "Add Vendor"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Vendor/Payee Name" required><input name="vendor_payee" defaultValue={editing?.vendor_payee as string || ""} className={inputClass} required /></FormField>
          <FormField label="Phone"><input name="phone_number" defaultValue={editing?.phone_number as string || ""} className={inputClass} /></FormField>
          <FormField label="Email"><input name="email_address" type="email" defaultValue={editing?.email_address as string || ""} className={inputClass} /></FormField>
          <FormField label="Point of Contact"><input name="point_of_contact" defaultValue={editing?.point_of_contact as string || ""} className={inputClass} /></FormField>
          <FormField label="Notes"><textarea name="notes" rows={4} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
