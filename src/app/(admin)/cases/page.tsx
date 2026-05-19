"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getCases,
  getWorkflowVendors,
  getCaseStatusHistory,
  getVendorJobsForStaff,
} from "@/lib/queries";
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
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  CASE_STATUSES,
  formatCaseStatus,
  INTAKE_REQUEST_TYPES,
} from "@/lib/workflow";
import { staffUpdateCase, staffAssignVendorJob } from "@/app/workflow-actions";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";

type CaseRow = Record<string, unknown>;
type VendorRow = Record<string, unknown>;

export default function CasesPage() {
  const [data, setData] = useState<CaseRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<CaseRow | null>(null);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [caseJobs, setCaseJobs] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getCases(), getWorkflowVendors()])
      .then(([cases, v]) => {
        setData(cases);
        setVendors(v);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load cases.");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      const matchSearch =
        !search ||
        [r.case_number, r.title, r.customer_name, r.customer_email, r.customer_phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    CASE_STATUSES.forEach((s) => {
      c[s] = data.filter((r) => r.status === s).length;
    });
    return c;
  }, [data]);

  const requestLabel = (type: string) =>
    INTAKE_REQUEST_TYPES.find((t) => t.value === type)?.label ?? type;

  const columns: Column<CaseRow>[] = [
    {
      key: "case_number",
      label: "Case",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{r.case_number as string}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{r.title as string}</p>
        </div>
      ),
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (r) => (
        <div>
          <p>{(r.customer_name as string) || "—"}</p>
          <p className="text-xs text-gray-500">{r.customer_phone as string}</p>
        </div>
      ),
    },
    {
      key: "request_type",
      label: "Type",
      render: (r) => (
        <span className="text-sm">{requestLabel(String(r.request_type ?? ""))}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={formatCaseStatus(String(r.status ?? ""))} />,
    },
    {
      key: "created_at",
      label: "Opened",
      render: (r) => <span className="text-sm">{formatDate(r.created_at as string)}</span>,
    },
  ];

  const openCase = async (row: CaseRow) => {
    setEditing(row);
    setModalOpen(true);
    setError(null);
    const id = String(row.id);
    const [h, jobs] = await Promise.all([getCaseStatusHistory(id), getVendorJobsForStaff(id)]);
    setHistory(h);
    setCaseJobs(jobs);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", String(editing.id));
    const result = await staffUpdateCase(fd);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setModalOpen(false);
    setEditing(null);
    load();
  };

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("case_id", String(editing.id));
    const result = await staffAssignVendorJob(fd);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setAssignOpen(false);
    await openCase(editing);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Workflow cases"
        description={`${data.length} cases · intake → assignment → vendor → completion`}
        action={
          <Link href="/forms/customer-intake" target="_blank">
            <Button variant="secondary">
              <ExternalLink size={16} />
              Public intake
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6 max-h-48 overflow-y-auto">
        {CASE_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            className={`p-2 rounded-lg border text-left text-xs transition-all ${
              statusFilter === s
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            }`}
          >
            <p className="font-bold text-gray-900 dark:text-white">{counts[s] || 0}</p>
            <p className="text-gray-500 dark:text-slate-400 truncate">{formatCaseStatus(s)}</p>
          </button>
        ))}
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search cases…">
        <select
          className={selectClass + " sm:w-56"}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatCaseStatus(s)}
            </option>
          ))}
        </select>
      </FilterBar>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={openCase} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? String(editing.case_number) : "Case"}
      >
        {editing && (
          <div className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="Status" required>
                <select name="status" className={selectClass} defaultValue={String(editing.status)} required>
                  {CASE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {formatCaseStatus(s)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="ClickUp task ID">
                <input name="clickup_task_id" className={inputClass} defaultValue={String(editing.clickup_task_id ?? "")} />
              </FormField>
              <FormField label="ClickUp URL">
                <input name="clickup_url" type="url" className={inputClass} defaultValue={String(editing.clickup_url ?? "")} />
              </FormField>
              <FormField label="Internal notes">
                <textarea name="internal_notes" rows={3} className={inputClass} defaultValue={String(editing.internal_notes ?? "")} />
              </FormField>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save case"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setAssignOpen(true)}>
                  <Plus size={16} />
                  Assign vendor
                </Button>
              </div>
            </form>

            {caseJobs.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Vendor jobs</h3>
                <ul className="text-xs space-y-1 text-gray-600 dark:text-slate-400">
                  {caseJobs.map((j) => (
                    <li key={String(j.id)}>
                      {(j.vendors as { name?: string })?.name ?? "Vendor"} — {String(j.status)} — {j.title as string}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {history.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Status history</h3>
                <ul className="text-xs space-y-1 text-gray-600 dark:text-slate-400">
                  {history.map((h) => (
                    <li key={String(h.id)}>
                      {h.from_status ? `${h.from_status} → ` : ""}
                      {h.to_status as string} · {formatDateTime(h.created_at as string)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign outside vendor">
        {editing && (
          <form onSubmit={handleAssign} className="space-y-4">
            <FormField label="Vendor" required>
              <select name="vendor_id" className={selectClass} required>
                <option value="">Select vendor…</option>
                {vendors.map((v) => (
                  <option key={String(v.id)} value={String(v.id)}>
                    {v.name as string}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Job title" required>
              <input name="title" className={inputClass} required defaultValue={`Work for ${editing.case_number}`} />
            </FormField>
            <FormField label="Instructions">
              <textarea name="description" rows={3} className={inputClass} />
            </FormField>
            <Button type="submit" disabled={saving || vendors.length === 0}>
              {assignButtonLabel(saving, vendors.length)}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function assignButtonLabel(saving: boolean, vendorCount: number) {
  if (saving) return "Assigning…";
  if (vendorCount === 0) return "Add vendors in Workflow first";
  return "Offer job to vendor";
}
