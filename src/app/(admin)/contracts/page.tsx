"use client";

import { useEffect, useState, useMemo } from "react";
import { getContracts } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Contract = Record<string, unknown>;

const statusOptions = ["Draft", "Signed", "Active", "Completed", "Terminated"];

export default function ContractsPage() {
  const [data, setData] = useState<Contract[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => { setLoading(true); setError(null); getContracts().then((d) => { setData(d as Contract[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => {
    const matchSearch = !search || [r.active_customer].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || r.contract_status === statusFilter;
    return matchSearch && matchStatus;
  }), [data, search, statusFilter]);

  const columns: Column<Contract>[] = [
    { key: "contract_id", label: "ID", render: (r) => <span className="font-mono text-sm font-bold">#{r.contract_id as number}</span> },
    { key: "active_customer", label: "Customer" },
    { key: "contract_status", label: "Status", render: (r) => <StatusBadge status={r.contract_status as string} /> },
    { key: "start_date", label: "Start", render: (r) => <span className="text-sm">{formatDate(r.start_date as string)}</span> },
    { key: "end_date", label: "End", render: (r) => <span className="text-sm">{formatDate(r.end_date as string)}</span> },
    { key: "base_price", label: "Base Price", render: (r) => formatCurrency(r.base_price as number) },
    { key: "taxes_and_fees", label: "Taxes/Fees", render: (r) => formatCurrency(r.taxes_and_fees as number) },
    { key: "insurance_fee", label: "Insurance", render: (r) => formatCurrency(r.insurance_fee as number) },
    { key: "total_contract_amount", label: "Total", render: (r) => <span className="font-bold">{formatCurrency(r.total_contract_amount as number)}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    ["base_price", "taxes_and_fees", "insurance_fee", "total_contract_amount"].forEach((k) => { if (record[k]) record[k] = Number(record[k]); });
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("contracts").upsert(record);
    if (error) { console.error(error.message); setError("Failed to save. Please try again."); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Contracts" description={`${data.length} contracts`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Contract</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search contracts...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); }} title={editing ? "Edit Contract" : "New Contract"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Customer"><input name="active_customer" defaultValue={editing?.active_customer as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="contract_status" defaultValue={editing?.contract_status as string || "Draft"} className={selectClass}>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Start Date"><input name="start_date" type="date" defaultValue={editing?.start_date as string || ""} className={inputClass} /></FormField>
          <FormField label="End Date"><input name="end_date" type="date" defaultValue={editing?.end_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Base Price"><input name="base_price" type="number" step="0.01" defaultValue={editing?.base_price as number || ""} className={inputClass} /></FormField>
          <FormField label="Taxes & Fees"><input name="taxes_and_fees" type="number" step="0.01" defaultValue={editing?.taxes_and_fees as number || ""} className={inputClass} /></FormField>
          <FormField label="Insurance Fee"><input name="insurance_fee" type="number" step="0.01" defaultValue={editing?.insurance_fee as number || ""} className={inputClass} /></FormField>
          <FormField label="Total Amount"><input name="total_contract_amount" type="number" step="0.01" defaultValue={editing?.total_contract_amount as number || ""} className={inputClass} /></FormField>
          <FormField label="Contract Sent Date"><input name="contract_sent_date" type="date" defaultValue={editing?.contract_sent_date as string || ""} className={inputClass} /></FormField>
          <FormField label="Signed Date"><input name="signed_date" type="date" defaultValue={editing?.signed_date as string || ""} className={inputClass} /></FormField>
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
