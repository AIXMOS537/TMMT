"use client";

import { useEffect, useState, useMemo } from "react";
import { getDoNotRent } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DNR = Record<string, unknown>;

const sourceOptions = ["Background Check", "Internal Decision", "Legal", "External Report", "Customer Feedback", "Other"];
const riskOptions = ["High Risk", "Moderate Risk", "Low Risk", "Legal Issue", "Customer Issue", "Unknown"];

export default function DoNotRentPage() {
  const [data, setData] = useState<DNR[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DNR | null>(null);

  const load = () => { setLoading(true); getDoNotRent().then((d) => { setData(d as DNR[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => !search || [r.person_entity_name, r.contact_email, r.contact_phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))), [data, search]);

  const columns: Column<DNR>[] = [
    { key: "person_entity_name", label: "Name", render: (r) => <span className="font-medium text-gray-900 dark:text-white">{r.person_entity_name as string || "—"}</span> },
    { key: "contact_email", label: "Email" },
    { key: "contact_phone", label: "Phone" },
    { key: "source_of_restriction", label: "Source", render: (r) => <StatusBadge status={r.source_of_restriction as string} /> },
    { key: "alert_category_ai", label: "Risk Level", render: (r) => <StatusBadge status={r.alert_category_ai as string} /> },
    { key: "date_added", label: "Added", render: (r) => <span className="text-sm">{formatDate(r.date_added as string)}</span> },
    { key: "reason_for_restriction", label: "Reason", render: (r) => <span className="text-sm truncate max-w-[200px] block">{r.reason_for_restriction as string || "—"}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("do_not_rent_list").upsert(record);
    if (error) { alert(error.message); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Do Not Rent List" description={`${data.length} restricted persons/entities`} action={<Button variant="danger" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add to List</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search do not rent list..." />
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Edit Entry" : "Add to Do Not Rent List"}>
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Person/Entity Name" required><input name="person_entity_name" defaultValue={editing?.person_entity_name as string || ""} className={inputClass} required /></FormField>
          <FormField label="Email"><input name="contact_email" type="email" defaultValue={editing?.contact_email as string || ""} className={inputClass} /></FormField>
          <FormField label="Phone"><input name="contact_phone" defaultValue={editing?.contact_phone as string || ""} className={inputClass} /></FormField>
          <FormField label="Source of Restriction">
            <select name="source_of_restriction" defaultValue={editing?.source_of_restriction as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Alert Category">
            <select name="alert_category_ai" defaultValue={editing?.alert_category_ai as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {riskOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Date Added"><input name="date_added" type="date" defaultValue={editing?.date_added as string || ""} className={inputClass} /></FormField>
          <FormField label="Reason for Restriction"><textarea name="reason_for_restriction" rows={3} defaultValue={editing?.reason_for_restriction as string || ""} className={inputClass} /></FormField>
          <FormField label="Notes"><textarea name="notes" rows={2} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
