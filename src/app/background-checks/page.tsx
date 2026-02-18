"use client";

import { useEffect, useState, useMemo } from "react";
import { getBackgroundChecks } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type BgCheck = Record<string, unknown>;

const eligibilityOptions = ["Eligible", "Not Eligible", "Need Manager's Review", "ou", "out of radius", "Not found"];
const bgStatusOptions = ["Pending", "Verified", "Failed"];
const insuranceOwn = ["Yes", "No"];

export default function BackgroundChecksPage() {
  const [data, setData] = useState<BgCheck[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BgCheck | null>(null);

  const load = () => { setLoading(true); getBackgroundChecks().then((d) => { setData(d as BgCheck[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch = !search || [r.customer_name, r.email, r.phone_number].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchStatus = !statusFilter || r.eligibility_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const columns: Column<BgCheck>[] = [
    { key: "customer_name", label: "Customer", render: (r) => (
      <div>
        <p className="font-medium text-gray-900">{r.customer_name as string || "—"}</p>
        <p className="text-xs text-gray-500">ID: {r.customer_id as number}</p>
      </div>
    )},
    { key: "phone_number", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "eligibility_status", label: "Eligibility", render: (r) => <StatusBadge status={r.eligibility_status as string} /> },
    { key: "background_check_status", label: "BG Check", render: (r) => <StatusBadge status={r.background_check_status as string} /> },
    { key: "insurance_check_status", label: "Insurance", render: (r) => <StatusBadge status={r.insurance_check_status as string} /> },
    { key: "earnings_verification_status", label: "Earnings", render: (r) => <StatusBadge status={r.earnings_verification_status as string} /> },
    { key: "own_insurance", label: "Own Ins?", render: (r) => <span>{r.own_insurance as string || "—"}</span> },
    { key: "date_verified", label: "Verified", render: (r) => <span className="text-sm">{formatDate(r.date_verified as string)}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.verification_form_submitted) record.verification_form_submitted = record.verification_form_submitted === "true";
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("background_checks").upsert(record);
    if (error) { alert(error.message); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader
        title="Background Checks"
        description={`${data.length} total checks`}
        action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Check</Button>}
      />

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by name, email, phone...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Eligibility</option>
          {eligibilityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Edit Background Check" : "New Background Check"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Customer Name" required><input name="customer_name" defaultValue={editing?.customer_name as string || ""} className={inputClass} required /></FormField>
          <FormField label="Phone"><input name="phone_number" defaultValue={editing?.phone_number as string || ""} className={inputClass} /></FormField>
          <FormField label="Email"><input name="email" type="email" defaultValue={editing?.email as string || ""} className={inputClass} /></FormField>
          <FormField label="Own Insurance?">
            <select name="own_insurance" defaultValue={editing?.own_insurance as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {insuranceOwn.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Eligibility Status">
            <select name="eligibility_status" defaultValue={editing?.eligibility_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {eligibilityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="BG Check Status">
            <select name="background_check_status" defaultValue={editing?.background_check_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {bgStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Insurance Check Status">
            <select name="insurance_check_status" defaultValue={editing?.insurance_check_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {bgStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Earnings Verification">
            <select name="earnings_verification_status" defaultValue={editing?.earnings_verification_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {bgStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Date Verified"><input name="date_verified" type="date" defaultValue={editing?.date_verified as string || ""} className={inputClass} /></FormField>
          <FormField label="Verification Form Submitted?">
            <select name="verification_form_submitted" defaultValue={editing?.verification_form_submitted ? "true" : "false"} className={selectClass}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </FormField>
          <div className="sm:col-span-2"><FormField label="Review Notes"><textarea name="review_notes" rows={3} defaultValue={editing?.review_notes as string || ""} className={inputClass} /></FormField></div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
