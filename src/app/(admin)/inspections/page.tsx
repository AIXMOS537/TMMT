"use client";

import { useEffect, useState, useMemo } from "react";
import { getInspections } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Insp = Record<string, unknown>;

const statusOptions = ["Passed", "Failed", "Pending", "Needs Review"];
const typeOptions = ["Return Inspection", "Final Inspection"];
const followupOptions = ["Yes", "No"];

export default function InspectionsPage() {
  const [data, setData] = useState<Insp[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Insp | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => { setLoading(true); setError(null); getInspections().then((d) => { setData(d as Insp[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.inspection_name, r.inspector_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.inspection_status === statusFilter;
    return matchSearch && matchStatus;
  }), [data, search, statusFilter]);

  const columns: Column<Insp>[] = [
    { key: "inspection_name", label: "Name" },
    { key: "inspector_name", label: "Inspector" },
    { key: "date_of_inspection", label: "Date", render: (r) => <span className="text-sm">{formatDate(r.date_of_inspection as string)}</span> },
    { key: "odometer_reading_at_inspection", label: "Odometer", render: (r) => r.odometer_reading_at_inspection ? Number(r.odometer_reading_at_inspection).toLocaleString() : "—" },
    { key: "inspection_status", label: "Status", render: (r) => <StatusBadge status={r.inspection_status as string} /> },
    { key: "inspection_type", label: "Type", render: (r) => <StatusBadge status={r.inspection_type as string} /> },
    { key: "is_followup_needed", label: "Follow-up?" },
    { key: "next_scheduled_inspection", label: "Next", render: (r) => <span className="text-sm">{formatDate(r.next_scheduled_inspection as string)}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.odometer_reading_at_inspection) record.odometer_reading_at_inspection = Number(record.odometer_reading_at_inspection);
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("fleet_car_inspections").upsert(record);
    if (error) { console.error(error.message); setError("Failed to save. Please try again."); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Fleet Car Inspections" description={`${data.length} inspections`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Inspection</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search inspections...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); }} title={editing ? "Edit Inspection" : "New Inspection"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Inspection Name"><input name="inspection_name" defaultValue={editing?.inspection_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Inspector Name"><input name="inspector_name" defaultValue={editing?.inspector_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Date"><input name="date_of_inspection" type="date" defaultValue={editing?.date_of_inspection as string || ""} className={inputClass} /></FormField>
          <FormField label="Odometer Reading"><input name="odometer_reading_at_inspection" type="number" defaultValue={editing?.odometer_reading_at_inspection as number || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="inspection_status" defaultValue={editing?.inspection_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Inspection Type">
            <select name="inspection_type" defaultValue={editing?.inspection_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Follow-up Needed?">
            <select name="is_followup_needed" defaultValue={editing?.is_followup_needed as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {followupOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Next Scheduled"><input name="next_scheduled_inspection" type="date" defaultValue={editing?.next_scheduled_inspection as string || ""} className={inputClass} /></FormField>
          <FormField label="Notes"><textarea name="inspection_notes" rows={3} defaultValue={editing?.inspection_notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
