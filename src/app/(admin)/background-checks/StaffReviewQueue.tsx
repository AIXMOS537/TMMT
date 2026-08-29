"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getBgCheckQueue,
  decideBgCheck,
  BG_CHECK_DECISIONS,
  type BgCheckQueueRow,
  type BgCheckDecision,
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
import { formatDate } from "@/lib/utils";
import { ShieldCheck, FileText, Car, Receipt, Camera } from "lucide-react";

/**
 * Staff-facing review queue.
 *
 * The background_checks table is admin-only at the database level. Everything
 * here comes from the bg_check_queue RPC, which returns masked contact details
 * and presence flags instead of the raw licence, insurance and paystub files.
 * Decisions go back through bg_check_decide, which writes only the verdict.
 */

function DocPill({ ok, label, icon }: { ok: boolean | null; label: string; icon: React.ReactNode }) {
  return (
    <span
      title={ok ? `${label} on file` : `${label} missing`}
      className={
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs " +
        (ok
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500")
      }
    >
      {icon}
      <span className="sr-only">{ok ? `${label} on file` : `${label} missing`}</span>
    </span>
  );
}

export default function StaffReviewQueue() {
  const [rows, setRows] = useState<BgCheckQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [active, setActive] = useState<BgCheckQueueRow | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<BgCheckDecision | null>(null);

  // Called from event handlers (after a decision is saved).
  const load = () => {
    setLoading(true);
    setError(null);
    return getBgCheckQueue()
      .then((d) => {
        setRows(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message || "Could not load the review queue.");
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    getBgCheckQueue()
      .then((d) => {
        if (cancelled) return;
        setRows(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || "Could not load the review queue.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = search.trim().toLowerCase();
        const matchSearch =
          !q ||
          [r.customer_name, r.email_masked, r.phone_last4]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
        const matchStatus = !statusFilter || r.eligibility_status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [rows, search, statusFilter]
  );

  const pending = useMemo(
    () => rows.filter((r) => !r.eligibility_status || r.eligibility_status === "Need Manager's Review").length,
    [rows]
  );

  const columns: Column<BgCheckQueueRow>[] = [
    {
      key: "customer_name",
      label: "Customer",
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{r.customer_name || "—"}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {r.email_masked || "no email"}
            {r.phone_last4 ? ` · ••••${r.phone_last4}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "has_license",
      label: "Documents",
      render: (r) => (
        <div className="flex items-center gap-1">
          <DocPill ok={r.has_license} label="Licence" icon={<Car size={13} />} />
          <DocPill ok={r.has_insurance_proof} label="Insurance" icon={<FileText size={13} />} />
          <DocPill ok={r.has_paystub} label="Paystub" icon={<Receipt size={13} />} />
          <DocPill ok={r.has_screenshot} label="Check screenshot" icon={<Camera size={13} />} />
        </div>
      ),
    },
    {
      key: "eligibility_status",
      label: "Decision",
      render: (r) =>
        r.eligibility_status ? <StatusBadge status={r.eligibility_status} /> : (
          <span className="text-xs text-amber-600 dark:text-amber-400">Awaiting review</span>
        ),
    },
    {
      key: "created_at",
      label: "Submitted",
      render: (r) => <span className="text-sm">{formatDate(r.created_at as string)}</span>,
    },
    {
      key: "reviewed_at",
      label: "Reviewed",
      render: (r) => (
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {r.reviewed_at ? formatDate(r.reviewed_at) : "—"}
        </span>
      ),
    },
  ];

  const openReview = (r: BgCheckQueueRow) => {
    setActive(r);
    setNotes(r.review_notes ?? "");
    setError(null);
  };

  const submit = async (decision: BgCheckDecision) => {
    if (!active) return;
    setSaving(decision);
    setError(null);
    try {
      await decideBgCheck(active.id, decision, notes);
      setActive(null);
      setSaving(null);
      load();
    } catch (e) {
      setError((e as Error).message || "Could not save that decision.");
      setSaving(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Background Check Review"
        description={
          pending > 0
            ? `${pending} awaiting review · ${rows.length} total`
            : `${rows.length} total checks`
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <p>
          Contact details are masked and documents are shown as on-file or missing. Full records are
          restricted to admins.
        </p>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by name or masked contact..."
      >
        <select
          className={selectClass + " sm:w-56"}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All decisions</option>
          {BG_CHECK_DECISIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FilterBar>

      <ErrorBanner message={!active ? error : null} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} onRowClick={openReview} />
      )}

      <Modal
        open={!!active}
        onClose={() => {
          setActive(null);
          setError(null);
          setSaving(null);
        }}
        title={active?.customer_name ? `Review — ${active.customer_name}` : "Review"}
        wide
      >
        {active && (
          <div className="grid grid-cols-1 gap-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Email</p>
                <p className="font-medium">{active.email_masked || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Phone</p>
                <p className="font-medium">{active.phone_last4 ? `••••${active.phone_last4}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Submitted</p>
                <p className="font-medium">{formatDate(active.created_at as string)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Form submitted</p>
                <p className="font-medium">{active.verification_form_submitted ? "Yes" : "No"}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-gray-500 dark:text-slate-400">Documents on file</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {[
                  ["Licence", active.has_license],
                  ["Proof of insurance", active.has_insurance_proof],
                  ["Paystub", active.has_paystub],
                  ["Check screenshot", active.has_screenshot],
                ].map(([label, ok]) => (
                  <span
                    key={String(label)}
                    className={
                      "rounded px-2 py-1 " +
                      (ok
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400")
                    }
                  >
                    {ok ? "✓" : "—"} {String(label)}
                  </span>
                ))}
              </div>
            </div>

            {active.key_details && (
              <div>
                <p className="mb-1 text-xs text-gray-500 dark:text-slate-400">
                  Key details from the check
                </p>
                <p className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm dark:bg-slate-800">
                  {active.key_details}
                </p>
              </div>
            )}

            <FormField label="Review notes">
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={4000}
                className={inputClass}
                placeholder="What you saw, and why you decided this way."
              />
            </FormField>

            <div>
              <p className="mb-2 text-xs text-gray-500 dark:text-slate-400">
                Record a decision
                {active.eligibility_status ? ` · currently “${active.eligibility_status}”` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => submit("Eligible")} disabled={!!saving}>
                  {saving === "Eligible" ? "Saving..." : "Pass — Eligible"}
                </Button>
                <Button variant="secondary" onClick={() => submit("Not Eligible")} disabled={!!saving}>
                  {saving === "Not Eligible" ? "Saving..." : "Fail — Not Eligible"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => submit("Need Manager's Review")}
                  disabled={!!saving}
                >
                  {saving === "Need Manager's Review" ? "Saving..." : "Escalate to manager"}
                </Button>
                <Button variant="secondary" onClick={() => submit("out of radius")} disabled={!!saving}>
                  {saving === "out of radius" ? "Saving..." : "Out of radius"}
                </Button>
                <Button variant="secondary" onClick={() => submit("Not found")} disabled={!!saving}>
                  {saving === "Not found" ? "Saving..." : "Not found"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
