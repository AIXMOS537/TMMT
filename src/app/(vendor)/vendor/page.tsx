"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getVendorPortalJobs,
  getVendorJobUpdates,
  getVendorJobFiles,
} from "@/lib/queries";
import {
  PageHeader,
  Card,
  StatusBadge,
  Button,
  Modal,
  FormField,
  ErrorBanner,
  inputClass,
  selectClass,
} from "@/components/ui";
import { vendorUpdateJobStatus, vendorUploadJobFile } from "@/app/workflow-actions";
import { formatCaseStatus, formatVendorJobStatus, VENDOR_JOB_STATUSES } from "@/lib/workflow";
import { formatDateTime } from "@/lib/utils";
import { Briefcase, Upload } from "lucide-react";

type Job = Record<string, unknown> & {
  cases?: { case_number?: string; title?: string; customer_name?: string; status?: string };
};

export default function VendorPortalPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);
  const [updates, setUpdates] = useState<Record<string, unknown>[]>([]);
  const [files, setFiles] = useState<Record<string, unknown>[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    getVendorPortalJobs()
      .then((d) => {
        setJobs(d as Job[]);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load jobs.");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!statusFilter) return jobs;
    return jobs.filter((j) => j.status === statusFilter);
  }, [jobs, statusFilter]);

  const openJob = async (job: Job) => {
    setSelected(job);
    setActionError(null);
    const id = String(job.id);
    const [u, f] = await Promise.all([getVendorJobUpdates(id), getVendorJobFiles(id)]);
    setUpdates(u);
    setFiles(f);
  };

  const handleStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("vendor_job_id", String(selected.id));
    const result = await vendorUpdateJobStatus(fd);
    setSaving(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    load();
    await openJob(selected);
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("vendor_job_id", String(selected.id));
    const result = await vendorUploadJobFile(fd);
    setSaving(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    e.currentTarget.reset();
    await openJob(selected);
  };

  const activeCount = jobs.filter((j) =>
    ["offered", "accepted", "scheduled", "in_progress", "pending_review"].includes(
      String(j.status)
    )
  ).length;

  return (
    <div>
      <PageHeader
        title="Your jobs"
        description={`${activeCount} active · ${jobs.length} total assigned`}
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mb-4">
        <select
          className={selectClass + " max-w-xs"}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {VENDOR_JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatVendorJobStatus(s)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-600 dark:text-slate-400">
          No jobs assigned yet. Ask TMMT ops to link your login to a vendor record and assign work.
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((job) => (
            <li key={String(job.id)}>
              <button
                type="button"
                onClick={() => openJob(job)}
                className="w-full text-left"
              >
                <Card className="p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Briefcase size={16} className="text-blue-600 shrink-0" />
                        {job.title as string}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Case {job.cases?.case_number ?? "—"} · {job.cases?.title ?? ""}
                      </p>
                    </div>
                    <StatusBadge status={formatVendorJobStatus(String(job.status))} />
                  </div>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? (selected.title as string) : "Job"}
      >
        {selected && (
          <div className="space-y-6">
            <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
            <div className="text-sm text-gray-600 dark:text-slate-400 space-y-1">
              <p>
                <span className="font-medium text-gray-800 dark:text-slate-200">Case:</span>{" "}
                {selected.cases?.case_number} — {formatCaseStatus(String(selected.cases?.status ?? ""))}
              </p>
              {selected.description ? <p>{selected.description as string}</p> : null}
            </div>

            <form onSubmit={handleStatus} className="space-y-3 border-t border-gray-200 dark:border-slate-700 pt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Update status</h3>
              <FormField label="Status" required>
                <select name="status" className={selectClass} defaultValue={String(selected.status)} required>
                  {VENDOR_JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {formatVendorJobStatus(s)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Note">
                <textarea name="note" rows={2} className={inputClass} placeholder="Optional update note" />
              </FormField>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save status"}
              </Button>
            </form>

            <form onSubmit={handleUpload} className="space-y-3 border-t border-gray-200 dark:border-slate-700 pt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                <Upload size={16} /> Upload photo or invoice
              </h3>
              <FormField label="File" required>
                <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
              </FormField>
              <Button type="submit" variant="secondary" disabled={saving}>
                Upload
              </Button>
            </form>

            {updates.length > 0 && (
              <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                <h3 className="font-semibold text-sm mb-2">Activity</h3>
                <ul className="text-xs space-y-2 text-gray-600 dark:text-slate-400">
                  {updates.map((u) => (
                    <li key={String(u.id)}>
                      {formatVendorJobStatus(String(u.status))}
                      {u.note ? ` — ${u.note}` : ""}
                      <span className="text-gray-400"> · {formatDateTime(u.created_at as string)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Files</h3>
                <ul className="text-xs text-gray-600 dark:text-slate-400">
                  {files.map((f) => (
                    <li key={String(f.id)}>{f.file_name as string}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
