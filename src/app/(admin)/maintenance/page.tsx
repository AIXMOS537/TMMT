"use client";

import { useEffect, useState, useMemo } from "react";
import { getMaintenance } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/app/(admin)/admin-actions";

type Maint = Record<string, unknown>;

const typeOptions = ["Routine", "Repair", "Emissions", "Inspection", "Other"];
const statusOptions = ["Scheduled", "Completed", "No-Show", "Late", "Cancelled"];

export default function MaintenancePage() {
  const [data, setData] = useState<Maint[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Maint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); setError(null); getMaintenance().then((d) => { setData(d as Maint[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => !search || [r.active_customer_if_applicable, r.assigned_staff, r.service_provider_location].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))), [data, search]);

  const columns: Column<Maint>[] = [
    { key: "maintenance_appointment_id", label: "ID", render: (r) => <span className="font-mono text-sm">#{r.maintenance_appointment_id as number}</span> },
    { key: "maintenance_type", label: "Type", render: (r) => <StatusBadge status={r.maintenance_type as string} /> },
    { key: "active_customer_if_applicable", label: "Customer" },
    { key: "appointment_date_time", label: "Date/Time", render: (r) => <span className="text-sm">{formatDateTime(r.appointment_date_time as string)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
    { key: "assigned_staff", label: "Staff" },
    { key: "service_provider_location", label: "Provider/Location" },
    { key: "fee_assessed_if_no_show_late", label: "Fee", render: (r) => formatCurrency(r.fee_assessed_if_no_show_late as number) },
    { key: "was_customer_notified_of_fee", label: "Notified?", render: (r) => r.was_customer_notified_of_fee ? "✓" : "—" },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.fee_assessed_if_no_show_late) record.fee_assessed_if_no_show_late = Number(record.fee_assessed_if_no_show_late);
    if (record.was_customer_notified_of_fee) record.was_customer_notified_of_fee = record.was_customer_notified_of_fee === "true";
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("maintenance_appointments", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Maintenance Appointments" description={`${data.length} appointments`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Appointment</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search maintenance..." />
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Maintenance Appt" : "New Maintenance Appt"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Maintenance Type">
            <select name="maintenance_type" defaultValue={editing?.maintenance_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Customer (if applicable)"><input name="active_customer_if_applicable" defaultValue={editing?.active_customer_if_applicable as string || ""} className={inputClass} /></FormField>
          <FormField label="Date & Time"><input name="appointment_date_time" type="datetime-local" defaultValue={editing?.appointment_date_time as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="status" defaultValue={editing?.status as string || "Scheduled"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Assigned Staff"><input name="assigned_staff" defaultValue={editing?.assigned_staff as string || ""} className={inputClass} /></FormField>
          <FormField label="Service Provider/Location"><input name="service_provider_location" defaultValue={editing?.service_provider_location as string || ""} className={inputClass} /></FormField>
          <FormField label="Fee (No-Show/Late)"><input name="fee_assessed_if_no_show_late" type="number" step="0.01" defaultValue={editing?.fee_assessed_if_no_show_late as number || ""} className={inputClass} /></FormField>
          <FormField label="Notes"><textarea name="notes" rows={3} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
