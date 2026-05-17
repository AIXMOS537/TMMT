"use client";

import { useEffect, useState, useMemo } from "react";
import { getAppointments } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { Plus } from "lucide-react";
import { adminUpsert } from "@/lib/admin-actions";

type Appt = Record<string, unknown>;

const typeOptions = ["In-Person Visit", "Contract Signing", "Other"];
const statusOptions = ["Scheduled", "Completed", "Cancelled", "No-Show"];

export default function AppointmentsPage() {
  const [data, setData] = useState<Appt[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Appt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); setError(null); getAppointments().then((d) => { setData(d as Appt[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    return !search || [r.preferred_vehicle_make_model, r.assigned_staff, r.location].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
  }), [data, search]);

  const columns: Column<Appt>[] = [
    { key: "appointment_id", label: "ID", render: (r) => <span className="font-mono text-sm">#{r.appointment_id as number}</span> },
    { key: "appointment_type", label: "Type", render: (r) => <StatusBadge status={r.appointment_type as string} /> },
    { key: "preferred_vehicle_make_model", label: "Vehicle Preference" },
    { key: "appointment_date_time", label: "Date/Time", render: (r) => <span className="text-sm">{formatDateTime(r.appointment_date_time as string)}</span> },
    { key: "appointment_status", label: "Status", render: (r) => <StatusBadge status={r.appointment_status as string} /> },
    { key: "assigned_staff", label: "Staff" },
    { key: "location", label: "Location" },
    { key: "vehicle_preference_confirmed", label: "Confirmed", render: (r) => r.vehicle_preference_confirmed ? "✓" : "—" },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.vehicle_preference_confirmed) record.vehicle_preference_confirmed = record.vehicle_preference_confirmed === "true";
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("appointments", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Appointments" description={`${data.length} appointments`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Appointment</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search appointments..." />
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Appointment" : "New Appointment"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Appointment Type">
            <select name="appointment_type" defaultValue={editing?.appointment_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Date & Time"><input name="appointment_date_time" type="datetime-local" defaultValue={editing?.appointment_date_time as string || ""} className={inputClass} /></FormField>
          <FormField label="Vehicle Preference"><input name="preferred_vehicle_make_model" defaultValue={editing?.preferred_vehicle_make_model as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="appointment_status" defaultValue={editing?.appointment_status as string || "Scheduled"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Staff"><input name="assigned_staff" defaultValue={editing?.assigned_staff as string || ""} className={inputClass} /></FormField>
          <FormField label="Location"><input name="location" defaultValue={editing?.location as string || ""} className={inputClass} /></FormField>
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
