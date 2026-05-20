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
import { Plus } from "lucide-react";
import { adminUpsert } from "@/lib/admin-actions";
import { FleetRateEstimate } from "@/components/FleetRateEstimate";
import { FleetDiscountPanel } from "@/components/FleetDiscountPanel";

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
  const [saving, setSaving] = useState(false);
  const [estimateInputs, setEstimateInputs] = useState({
    acquisitionCost: "",
    listPrice: "",
    operatorInsuranceMonthly: "",
    insuranceMarkup: "2",
    vehicleMake: "",
    vehicleModel: "",
    year: "",
  });
  const [weeklyRateDraft, setWeeklyRateDraft] = useState("");
  const [weeklyPricesDraft, setWeeklyPricesDraft] = useState("");
  const [lowestPriceDraft, setLowestPriceDraft] = useState("");

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
    { key: "weekly_rate", label: "Weekly Rate", render: (r) => (
      <span>{r.weekly_rate != null ? `$${Number(r.weekly_rate).toFixed(0)}` : r.weekly_prices as string || "—"}</span>
    )},
    { key: "suggested_weekly_rate", label: "Suggested", render: (r) => (
      <span className="text-emerald-700 dark:text-emerald-400">
        {r.suggested_weekly_rate != null ? `$${Number(r.suggested_weekly_rate).toFixed(0)}` : "—"}
      </span>
    )},
    { key: "partner_name", label: "Partner" },
    { key: "finance_status", label: "Finance", render: (r) => <StatusBadge status={r.finance_status as string} /> },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.year) record.year = Number(record.year);
    if (record.mileage) record.mileage = Number(record.mileage);
    if (record.lowest_possible_price) record.lowest_possible_price = Number(record.lowest_possible_price);
    if (record.partner_percentage) record.partner_percentage = Number(record.partner_percentage);
    if (record.acquisition_cost) record.acquisition_cost = Number(record.acquisition_cost);
    if (record.list_price) record.list_price = Number(record.list_price);
    if (record.operator_insurance_monthly) record.operator_insurance_monthly = Number(record.operator_insurance_monthly);
    if (record.insurance_markup_multiplier) record.insurance_markup_multiplier = Number(record.insurance_markup_multiplier);
    if (record.weekly_rate) record.weekly_rate = Number(record.weekly_rate);
    if (record.suggested_weekly_rate) record.suggested_weekly_rate = Number(record.suggested_weekly_rate);
    if (record.suggested_daily_rate) record.suggested_daily_rate = Number(record.suggested_daily_rate);
    if (editing?.id) record.id = editing.id;

    const { suggestRentalRateFromFleetRow } = await import("@/lib/rental-pricing/suggest-rental-rate");
    const est = suggestRentalRateFromFleetRow({
      acquisition_cost: record.acquisition_cost as number | null,
      list_price: record.list_price as number | null,
      operator_insurance_monthly: record.operator_insurance_monthly as number | null,
      insurance_markup_multiplier: record.insurance_markup_multiplier as number | null,
      vehicle_make: record.vehicle_make as string,
      vehicle_model: record.vehicle_model as string,
      year: record.year as number,
    });
    record.suggested_weekly_rate = est.suggestedWeeklyLetGoCents / 100;
    record.suggested_daily_rate = est.suggestedDailyLetGoCents / 100;

    const result = await adminUpsert("fleet", record);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setSaving(false);
    setModalOpen(false);
    setEditing(null);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Fleet Vehicles"
        description={`${data.length} vehicles in fleet`}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setEstimateInputs({
                acquisitionCost: "",
                listPrice: "",
                operatorInsuranceMonthly: "",
                insuranceMarkup: "2",
                vehicleMake: "",
                vehicleModel: "",
                year: "",
              });
              setWeeklyRateDraft("");
              setWeeklyPricesDraft("");
              setLowestPriceDraft("");
              setModalOpen(true);
            }}
          >
            <Plus size={16} />
            Add Vehicle
          </Button>
        }
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
          onRowClick={(r) => {
            setEditing(r);
            setEstimateInputs({
              acquisitionCost: String(r.acquisition_cost ?? ""),
              listPrice: String(r.list_price ?? ""),
              operatorInsuranceMonthly: String(r.operator_insurance_monthly ?? ""),
              insuranceMarkup: String(r.insurance_markup_multiplier ?? "2"),
              vehicleMake: String(r.vehicle_make ?? ""),
              vehicleModel: String(r.vehicle_model ?? ""),
              year: String(r.year ?? ""),
            });
            setWeeklyRateDraft(String(r.weekly_rate ?? ""));
            setWeeklyPricesDraft(String(r.weekly_prices ?? ""));
            setLowestPriceDraft(String(r.lowest_possible_price ?? ""));
            setModalOpen(true);
          }}
        />
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Vehicle" : "Add Vehicle"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Vehicle Name"><input name="vehicle_name" defaultValue={editing?.vehicle_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Partner Name"><input name="partner_name" defaultValue={editing?.partner_name as string || ""} className={inputClass} /></FormField>
          <FormField label="Year">
            <input
              name="year"
              type="number"
              value={estimateInputs.year}
              onChange={(e) => setEstimateInputs((s) => ({ ...s, year: e.target.value }))}
              className={inputClass}
            />
          </FormField>
          <FormField label="Make">
            <input
              name="vehicle_make"
              value={estimateInputs.vehicleMake}
              onChange={(e) => setEstimateInputs((s) => ({ ...s, vehicleMake: e.target.value }))}
              className={inputClass}
            />
          </FormField>
          <FormField label="Model">
            <input
              name="vehicle_model"
              value={estimateInputs.vehicleModel}
              onChange={(e) => setEstimateInputs((s) => ({ ...s, vehicleModel: e.target.value }))}
              className={inputClass}
            />
          </FormField>
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
          <FormField label="Acquisition cost ($)">
            <input
              name="acquisition_cost"
              type="number"
              step="0.01"
              value={estimateInputs.acquisitionCost}
              onChange={(e) => setEstimateInputs((s) => ({ ...s, acquisitionCost: e.target.value }))}
              className={inputClass}
            />
          </FormField>
          <FormField label="List / market price ($)">
            <input
              name="list_price"
              type="number"
              step="0.01"
              value={estimateInputs.listPrice}
              onChange={(e) => setEstimateInputs((s) => ({ ...s, listPrice: e.target.value }))}
              className={inputClass}
            />
          </FormField>
          <FormField label="Your insurance ($/mo)">
            <input
              name="operator_insurance_monthly"
              type="number"
              step="0.01"
              value={estimateInputs.operatorInsuranceMonthly}
              onChange={(e) =>
                setEstimateInputs((s) => ({ ...s, operatorInsuranceMonthly: e.target.value }))
              }
              className={inputClass}
              placeholder="What you pay to insure this car"
            />
          </FormField>
          <FormField label="Insurance markup (×)">
            <input
              name="insurance_markup_multiplier"
              type="number"
              step="0.1"
              min={2}
              value={estimateInputs.insuranceMarkup}
              onChange={(e) => setEstimateInputs((s) => ({ ...s, insuranceMarkup: e.target.value }))}
              className={inputClass}
            />
          </FormField>
          <FleetRateEstimate
            acquisitionCost={estimateInputs.acquisitionCost}
            listPrice={estimateInputs.listPrice}
            operatorInsuranceMonthly={estimateInputs.operatorInsuranceMonthly}
            insuranceMarkup={estimateInputs.insuranceMarkup}
            vehicleMake={estimateInputs.vehicleMake}
            vehicleModel={estimateInputs.vehicleModel}
            year={estimateInputs.year}
            onApply={(rates) => {
              setWeeklyRateDraft(String(rates.weekly));
              setWeeklyPricesDraft(String(rates.weekly));
              setLowestPriceDraft(String(rates.lowest));
            }}
          />
          <FleetDiscountPanel
            acquisitionCost={estimateInputs.acquisitionCost}
            listPrice={estimateInputs.listPrice}
            operatorInsuranceMonthly={estimateInputs.operatorInsuranceMonthly}
            insuranceMarkup={estimateInputs.insuranceMarkup}
            vehicleMake={estimateInputs.vehicleMake}
            vehicleModel={estimateInputs.vehicleModel}
            year={estimateInputs.year}
            vehicleId={editing?.id as string | undefined}
            vehicleName={editing?.vehicle_name as string | undefined}
            fleet={data.map((r) => ({
              id: r.id as string,
              vehicle_name: r.vehicle_name as string,
              vehicle_make: r.vehicle_make as string,
              vehicle_model: r.vehicle_model as string,
              year: r.year as number,
              vehicle_status: r.vehicle_status as string,
              acquisition_cost: r.acquisition_cost as number,
              list_price: r.list_price as number,
              operator_insurance_monthly: r.operator_insurance_monthly as number,
              insurance_markup_multiplier: r.insurance_markup_multiplier as number,
            }))}
            onApplyCloseRate={(weekly) => {
              setWeeklyRateDraft(String(weekly));
              setWeeklyPricesDraft(String(weekly));
              setLowestPriceDraft(String(weekly));
            }}
          />
          <FormField label="Weekly rate ($)">
            <input
              name="weekly_rate"
              type="number"
              step="0.01"
              value={weeklyRateDraft}
              onChange={(e) => setWeeklyRateDraft(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Weekly price label">
            <input
              name="weekly_prices"
              value={weeklyPricesDraft}
              onChange={(e) => setWeeklyPricesDraft(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Lowest price ($)">
            <input
              name="lowest_possible_price"
              type="number"
              step="0.01"
              value={lowestPriceDraft}
              onChange={(e) => setLowestPriceDraft(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Finance Status">
            <select name="finance_status" defaultValue={editing?.finance_status as string || ""} className={selectClass}>
              <option value="">Select...</option>
              <option value="Paid Off">Paid Off</option>
              <option value="Financed">Financed</option>
            </select>
          </FormField>
          <FormField label="Partner %"><input name="partner_percentage" type="number" step="0.01" defaultValue={editing?.partner_percentage as number || ""} className={inputClass} /></FormField>
          <div className="sm:col-span-2">
            <FormField label="Partner portal notes (investors only)">
              <textarea
                name="partner_portal_notes"
                rows={2}
                defaultValue={(editing?.partner_portal_notes as string) || ""}
                className={inputClass}
                placeholder="Short updates visible in the investor portal"
              />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Notes"><textarea name="notes" rows={3} defaultValue={editing?.notes as string || ""} className={inputClass} /></FormField>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Vehicle"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
