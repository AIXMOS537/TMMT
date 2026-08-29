"use client";

import { useEffect, useState, useMemo } from "react";
import { getBackgroundChecks, isPlatformAdmin } from "@/lib/queries";
import StaffReviewQueue from "./StaffReviewQueue";
import { PageHeader, DataTable, Column, StatusBadge, FilterBar, Button, ExportButton, Modal, FormField, ErrorBanner, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { saveBackgroundCheck } from "./actions";
import type { PrequalRouteOutcome } from "@/lib/aixmos-prequal-act";
import { LicensePhotoControls } from "@/components/AdminDocumentControls";

type BgCheck = Record<string, unknown>;

const eligibilityOptions = ["Eligible", "Not Eligible", "Need Manager's Review", "out of radius", "Not found"];
const consentOptions = [
  { value: "", label: "Not captured yet" },
  { value: "sms", label: "By SMS reply" },
  { value: "email", label: "By email reply" },
  { value: "verbal", label: "Verbally, on a call" },
];
const bgStatusOptions = ["Pending", "Verified", "Failed"];
const insuranceOwn = ["Yes", "No"];

export default function BackgroundChecksPage() {
  const [data, setData] = useState<BgCheck[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BgCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [routing, setRouting] = useState<PrequalRouteOutcome | null>(null);

  // background_checks is admin-only in the database. Staff get the review queue
  // instead, which reads masked data through the bg_check_queue RPC.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const load = () => { setLoading(true); setError(null); getBackgroundChecks().then((d) => { setData(d as BgCheck[]); setLoading(false); }).catch(() => { setError("Failed to load data."); setLoading(false); }); };

  useEffect(() => {
    let cancelled = false;
    isPlatformAdmin().then((admin) => {
      if (cancelled) return;
      setIsAdmin(admin);
      if (admin) load();
    });
    return () => { cancelled = true; };
  }, []);

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
        <p className="font-medium text-gray-900 dark:text-white">{r.customer_name as string || "—"}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">ID: {r.customer_id as number}</p>
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
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => { record[k] = v || null; });
    if (record.verification_form_submitted) record.verification_form_submitted = record.verification_form_submitted === "true";
    if (editing?.id) record.id = editing.id;
    const consent = (record.aixmos_consent as string) || null;
    // Not a background_checks column — it only tells the prequal lane whether
    // the person has already agreed to be handed to AIXMOS.
    delete record.aixmos_consent;
    const result = await saveBackgroundCheck(record, consent as "sms" | "email" | "verbal" | null);
    if (!result.success) { setSaving(false); setError(result.error); return; }
    setRouting(result.routing);
    setSaving(false); setModalOpen(false); setEditing(null); load();
  };

  if (isAdmin === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAdmin) return <StaffReviewQueue />;

  return (
    <div>
      <PageHeader
        title="Background Checks"
        description={`${data.length} total checks`}
        action={<div className="flex gap-2"><ExportButton data={filtered} columns={columns} filename="background-checks" /><Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} />New Check</Button></div>}
      />

      {routing && routing.action !== "none" && routing.action !== "await_review" && (
        <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm">
          <p className="font-medium text-blue-900 dark:text-blue-200">
            {routing.tagApplied ? `Tagged ${routing.tagApplied} in GHL.` : "No GHL tag applied."}
            {routing.handoff === "created" && " Handoff to AIXMOS created."}
            {routing.handoff === "awaiting_consent" && " Handoff waits on consent."}
            {routing.handoff === "already_open" && " A handoff for this person is already open."}
            {routing.handoff === "failed" && " Handoff could not be created."}
          </p>
          <p className="mt-1 text-blue-800 dark:text-blue-300">{routing.decision.reason}</p>
          {routing.errors.map((e) => (
            <p key={e} className="mt-1 text-amber-700 dark:text-amber-300">{e}</p>
          ))}
          <button type="button" onClick={() => setRouting(null)} className="mt-2 text-xs underline text-blue-700 dark:text-blue-300">Dismiss</button>
        </div>
      )}

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

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); setError(null); setSaving(false); }} title={editing ? "Edit Background Check" : "New Background Check"} wide>
        <>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <input type="hidden" name="drivers_license_front_path" value={String(editing?.drivers_license_front_path ?? "")} />
            <input type="hidden" name="drivers_license_back_path" value={String(editing?.drivers_license_back_path ?? "")} />
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
          <FormField label="AIXMOS handoff consent">
            <select name="aixmos_consent" defaultValue="" className={selectClass}>
              {consentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Only used when eligibility is <em>Not Eligible</em>. Moving someone from TMMT to
              AIXMOS needs their yes on record — without it they are tagged for the prequal SMS
              and the handoff waits.
            </p>
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
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
        <LicensePhotoControls
          table="background_checks"
          recordId={editing?.id ? String(editing.id) : null}
          frontPath={editing?.drivers_license_front_path as string | undefined}
          backPath={editing?.drivers_license_back_path as string | undefined}
          onChange={load}
        />
        </>
      </Modal>
    </div>
  );
}
