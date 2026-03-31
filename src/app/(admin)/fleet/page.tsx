"use client";

import { useEffect, useState, useMemo } from "react";
import { getFleet } from "@/lib/queries";
import {
  PageHeader,
  DataTable,
  Column,
  StatusBadge,
  FilterBar,
  Button,
  Modal,
  FormField,
  ErrorBanner,
  inputClass,
  selectClass,
} from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Fleet = Record<string, unknown>;

const statusOptions = ["Available", "Rented", "Under Maintenance", "Retired", "Coming Soon"];
const typeOptions = ["Sedan", "SUV", "Compact/Hatchback", "Pickup Truck", "Minivan", "Crossover", "Electric/Hybrid"];

export default function FleetPage() {
  const [data, setData] = useState<Fleet[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fleet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getFleet().then((d) => { setData(d as Fleet[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); });
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch =
        !search ||
        [r.vehicle_name, r.vehicle_make, r.vehicle_model, r.license_plate, r.partner_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchStatus = !statusFilter || r.vehicle_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const columns: Column<Fleet>[] = [
    { key: "vehicle_name", label: "Vehicle", render: (r) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{r.vehicle_name as string || "—"}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{r.vehicle_make as string} {r.vehicle_model as string} {r.year as number}</p>
      </div>
    )},
    { key: "vehicle_status", label: "Status", render: (r) => <StatusBadge status={r.vehicle_status as string} /> },
    { key: "type", label: "Type", render: (r) => <span>{r.type as string || "—"}</span> },
    { key: "color", label: "Color" },
    { key: "license_plate", label: "Plate" },
    { key: "mileage", label: "Mileage", render: (r) => r.mileage ? Number(r.mileage).toLocaleString() : "—" },
    { key: "weekly_prices", label: "Weekly Price" },
    { key: "partner_name", label: "Partner" },
    { key: "finance_status", label: "Finance", render: (r) => <StatusBadge status={r.finance_status as string} /> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.year) record.year = Number(record.year);
    if (record.mileage) record.mileage = Number(record.mileage);
    if (record.lowest_possible_price) record.lowest_possible_price = Number(record.lowest_possible_price);
    if (record.partner_percentage) record.partner_percentage = Number(record.partner_percentage);
    if (editing?.id) record.id = editing.id;

    const { error } = await supabase.from("fleet").upsert(record);
    if (error) { console.error(error.message); setError("Failed to save. Please try again."); return; }
    setModalOpen(false);
    setEditing(null);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Fleet Vehicles"
        description={`${data.length} vehicles in fleet`}
        action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />Add Vehicle</Button>}
      />

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search vehicles...">
        <select className={selectClass + " sm:w-48"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(r) => { setEditing(r); setModalOpen(true); }}
        />
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); }} title={editing ? "Edit Vehicle" : "Add Vehicle"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Vehicle Name"><input name="vehicle_name" defaultValue={editing?.vehicle_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Partner Name"><input name="partner_name" defaultValue={editing?.partner_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Year"><input name="year" type="number" defaultValue={editing?.year as number || ""} className={inputClass} /></FormField>
          <FormField label="Make"><input name="vehicle_make" defaultValue={editing?.vehicle_make as string || ""} className={inputClass} /></FormField>
          <FormField label="Model"><input name="vehicle_model" defaultValue={editing?.vehicle_model as string || ""} className={inputClass} /></FormField>
          <FormField label="Color"><input name="color" defaultValue={editing?.color as string || ""} className={inputClass} /></FormField>
          <FormField label="Status">
            <select name="vehicle_status" defaultValue={editing?.vehicle_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Type">
            <select name="type" defaultValue={editing?.type as string || ""} className={selectClass}>
              <option value="">Select...</option>
              {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="License Plate"><input name="license_plate" defaultValue={editing?.license_plate as string || ""} className={inputClass} /></FormField>
          <FormField label="VIN"><input name="vin_number" defaultValue={editing?.vin_number as string || ""} className={inputClass} /></FormField>
          <FormField label="Mileage"><input name="mileage" type="number" defaultValue={editing?.mileage as number || ""} className={inputClass} /></FormField>
          <FormField label="Lowest Price"><input name="lowest_possible_price" type="number" step="0.01" defaultValue={editing?.lowest_possible_price as number || ""} className={inputClass} /></FormField>
          <FormField label="Finance Status">
            <select name="finance_status" defaultValue={editing?.finance_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              <option value="Paid Off">Paid Off</option>
              <option value="Financed">Financed</option>
            </select>
          </FormField>
          <FormField label="Partner %"><input name="partner_percentage" type="number" step="0.01" defaultValue={editing?.partner_percentage as number || ""} className={inputClass} /></FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes"><textarea name="notes" rows={3} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">Save Vehicle</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
