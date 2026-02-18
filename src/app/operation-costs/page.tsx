"use client";

import { useEffect, useState, useMemo } from "react";
import { getOperationCosts } from "@/lib/queries";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, Modal, FormField, inputClass, selectClass } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type OpCost = Record<string, unknown>;

const typeOptions = ["Software", "Hardware", "Cloud Service", "Internal System", "Other"];
const licenseOptions = ["Active", "Inactive", "Trial", "Expired"];

export default function OperationCostsPage() {
  const [data, setData] = useState<OpCost[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OpCost | null>(null);

  const load = () => { setLoading(true); getOperationCosts().then((d) => { setData(d as OpCost[]); setLoading(false); }); };
  useEffect(load, []);

  const filtered = useMemo(() => data.filter((r) => !search || [r.tool_software_name, r.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))), [data, search]);

  const totalCost = useMemo(() => data.reduce((s, r) => s + (Number(r.prices) || 0), 0), [data]);

  const columns: Column<OpCost>[] = [
    { key: "tool_software_name", label: "Tool/Software", render: (r) => <span className="font-medium text-gray-900">{r.tool_software_name as string || "—"}</span> },
    { key: "type", label: "Type", render: (r) => <StatusBadge status={r.type as string} /> },
    { key: "prices", label: "Cost", render: (r) => <span className="font-semibold">{formatCurrency(r.prices as number)}</span> },
    { key: "license_subscription_status", label: "License Status", render: (r) => <StatusBadge status={r.license_subscription_status as string} /> },
    { key: "description", label: "Description", render: (r) => <span className="text-sm truncate max-w-[300px] block">{r.description as string || "—"}</span> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.prices) record.prices = Number(record.prices);
    if (editing?.id) record.id = editing.id;
    const { error } = await supabase.from("operation_costs").upsert(record);
    if (error) { alert(error.message); return; }
    setModalOpen(false); setEditing(null); load();
  };

  return (
    <div>
      <PageHeader title="Software & Tools" description={`${data.length} tools · Monthly: ${formatCurrency(totalCost)}`} action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add Tool</Button>} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search tools..." />
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <DataTable columns={columns} data={filtered} onRowClick={(r) => { setEditing(r); setModalOpen(true); }} />
      )}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Edit Tool/Software" : "Add Tool/Software"}>
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Tool/Software Name" required><input name="tool_software_name" defaultValue={editing?.tool_software_name as string || ""} className={inputClass} required /></FormField>
          <FormField label="Type">
            <select name="type" defaultValue={editing?.type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Cost"><input name="prices" type="number" step="0.01" defaultValue={editing?.prices as number || ""} className={inputClass} /></FormField>
          <FormField label="License Status">
            <select name="license_subscription_status" defaultValue={editing?.license_subscription_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {licenseOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Description"><textarea name="description" rows={3} defaultValue={editing?.description as string || ""} className={inputClass} /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
