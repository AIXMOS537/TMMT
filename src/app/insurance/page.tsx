"use client";

import { useEffect, useState, useMemo } from "react";
import { getInsurance } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, inputClass, selectClass } from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Ins = Record<string, unknown>;

const entityTypes = ["Vehicle", "Customer", "Company", "Other"];
const policyTypes = ["Auto Liability", "Collision", "Comprehensive", "Personal Injury", "Uninsured Motorist", "Fleet Blanket", "Other"];
const statusOptions = ["Active", "Expired", "Pending Renewal", "Canceled"];

export default function InsurancePage() {
  const [data, setData] = useState<Ins[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ins | null>(null);

  const load = () => { setLoading(true); getInsurance().then((d) => { setData(d as Ins[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.insured_vehicle, r.insured_customer, r.insurance_company_name, r.policy_number].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.insurance_status === statusFilter;
    return matchSearch && matchStatus;
  }), [data, search, statusFilter]);

  const columns: Column<Ins>[] = [
    { key: "insured_vehicle", label: "Vehicle", render: (r) => (
      <div>
        <p className="font-medium text-gray-900">{r.insured_vehicle as string || "—"}</p>
        <p className="text-xs text-gray-500">{r.insured_customer as string}</p>
      </div>
    )},
    { key: "insurance_company_name", label: "Company" },
    { key: "policy_number", label: "Policy #" },
    { key: "policy_type", label: "Type", render: (r) => <StatusBadge status={r.policy_type as string} /> },
    { key: "coverage_amount", label: "Coverage", render: (r) => formatCurrency(r.coverage_amount as number) },
    { key: "deductible", label: "Deductible", render: (r) => formatCurrency(r.deductible as number) },
    { key: "insurance_status", label: "Status", render: (r) => <StatusBadge status={r.insurance_status as string} /> },
    { key: "policy_start_date", label: "Start", render: (r) => <span className="text-sm">{formatDate(r.policy_start_date as string)}</span> },
    { key: "policy_end_date", label: "End", render: (r) => <span className="text-sm">{formatDate(r.policy_end_date as string)}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.coverage_amount) record.coverage_amount = Number(record.coverage_amount);
    if (record.deductible) record.deductible = Number(record.deductible);
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("insurance").upsert(record);
    if (error) { alert(error.message); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Insurance" description={`${data.length} policies`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add Policy</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search insurance...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Edit Policy" : "Add Policy"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Insured Vehicle"><input name="insured_vehicle" defaultValue={editing?.insured_vehicle as string || ""} className={inputClass} /></FormField>
          <FormField label="Insured Customer"><input name="insured_customer" defaultValue={editing?.insured_customer as string || ""} className={inputClass} /></FormField>
          <FormField label="Entity Type">
            <select name="insured_entity_type" defaultValue={editing?.insured_entity_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {entityTypes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Insurance Company"><input name="insurance_company_name" defaultValue={editing?.insurance_company_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Policy #"><input name="policy_number" defaultValue={editing?.policy_number as string || ""} className={inputClass} /></FormField>
          <FormField label="Policy Type">
            <select name="policy_type" defaultValue={editing?.policy_type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {policyTypes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Coverage Amount"><input name="coverage_amount" type="number" step="0.01" defaultValue={editing?.coverage_amount as number || ""} className={inputClass} /></FormField>
          <FormField label="Deductible"><input name="deductible" type="number" step="0.01" defaultValue={editing?.deductible as number || ""} className={inputClass} /></FormField>
          <FormField label="Start Date"><input name="policy_start_date" type="date" defaultValue={editing?.policy_start_date as string || ""} className={inputClass} /></FormField>
          <FormField label="End Date"><input name="policy_end_date" type="date" defaultValue={editing?.policy_end_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="insurance_status" defaultValue={editing?.insurance_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Renewal Reminder"><input name="renewal_reminder_date" type="date" defaultValue={editing?.renewal_reminder_date as string || ""} className={inputClass} /></FormField>
          <div className="sm:col-span-2"><FormField label="Notes"><textarea name="notes" rows={3} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField></div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
