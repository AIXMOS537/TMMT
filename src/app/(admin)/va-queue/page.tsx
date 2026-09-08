"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  PageHeader,
  DataTable,
  Column,
  StatusBadge,
  StatCard,
  FilterBar,
  Button,
  Modal,
  FormField,
  ErrorBanner,
  selectClass,
  inputClass,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  decideVaTask,
  getVaQueueSummary,
  listVaQueue,
  type VaDecision,
  type VaQueueRow,
  type VaQueueSummary,
  type VaTriage,
} from "./actions";

const TRIAGE_OPTIONS: { value: VaTriage; label: string }[] = [
  { value: "needs_approval", label: "Needs approval" },
  { value: "auto", label: "Auto (source resolved)" },
  { value: "ignore", label: "Ignored by classifier" },
  { value: "untriaged", label: "Not yet classified" },
];

const DECISION_LABEL: Record<VaDecision, string> = {
  approve: "Approve",
  handled: "Mark handled",
  dismiss: "Dismiss",
};

type Row = VaQueueRow & Record<string, unknown>;

function approvalOf(row: VaQueueRow): { by?: string; at?: string } | null {
  const a = row.result?.approval;
  return a && typeof a === "object" ? (a as { by?: string; at?: string }) : null;
}

export default function VaQueuePage() {
  const [summary, setSummary] = useState<VaQueueSummary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [triage, setTriage] = useState<VaTriage>("needs_approval");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [pending, setPending] = useState<{ row: VaQueueRow; decision: VaDecision } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [s, l] = await Promise.all([getVaQueueSummary(), listVaQueue({ triage })]);
    if (!s.success) setError(s.error);
    else setSummary(s.data);
    if (!l.success) setError(l.error);
    else setRows(l.data as Row[]);
    setLoading(false);
  }, [triage]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchCategory = !category || r.category === category;
        const q = search.trim().toLowerCase();
        const matchSearch =
          !q ||
          [r.subject_name, r.subject_phone, r.subject_email, r.triage_reason, r.source_id]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
        return matchCategory && matchSearch;
      }),
    [rows, category, search]
  );

  const submitDecision = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pending) return;
    setSaving(true);
    setError(null);
    const res = await decideVaTask(pending.row.id, pending.decision, note);
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setReceipt(
      `${DECISION_LABEL[res.data.decision]} saved for task #${res.data.id} by ${res.data.by} at ${new Date(res.data.at).toLocaleString()}.`
    );
    setPending(null);
    setNote("");
    void load();
  };

  const columns: Column<Row>[] = [
    {
      key: "subject_name",
      label: "Subject",
      render: (r) => (
        <div>
          <div className="font-medium">{(r.subject_name as string) || "—"}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {[r.subject_phone, r.subject_email].filter(Boolean).join(" · ") || "no contact on file"}
          </div>
        </div>
      ),
    },
    { key: "category", label: "Category", render: (r) => <StatusBadge status={r.category as string} /> },
    { key: "agent", label: "Agent" },
    { key: "priority", label: "Priority", render: (r) => <StatusBadge status={r.priority as string} /> },
    {
      key: "triage_reason",
      label: "Classifier reason",
      render: (r) => <span className="text-xs">{(r.triage_reason as string) || "—"}</span>,
    },
    {
      key: "source_id",
      label: "Source",
      render: (r) =>
        r.source_table ? (
          <span className="text-xs font-mono">{`${r.source_table}#${r.source_id ?? "?"}`}</span>
        ) : (
          <span className="text-xs text-gray-500">legacy (contact-keyed)</span>
        ),
    },
    { key: "sweep_date", label: "Sweep", render: (r) => <span className="text-sm">{formatDate(r.sweep_date as string)}</span> },
    {
      key: "approval",
      label: "Approved",
      noExport: true,
      render: (r) => {
        const a = approvalOf(r);
        return a ? (
          <span className="text-xs text-green-700 dark:text-green-400">
            {a.by ?? "owner"} · {a.at ? formatDate(a.at) : ""}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        );
      },
    },
    {
      key: "actions",
      label: "",
      noExport: true,
      render: (r) => (
        <div className="flex gap-2 justify-end">
          {summary?.canApprove && !approvalOf(r) && (
            <Button size="sm" onClick={() => { setPending({ row: r, decision: "approve" }); setNote(""); }}>
              Approve
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => { setPending({ row: r, decision: "handled" }); setNote(""); }}>
            Handled
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setPending({ row: r, decision: "dismiss" }); setNote(""); }}>
            Dismiss
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="VA Approval Queue"
        description="Tasks the AI classifier could not close on its own. Approving records your decision; nothing is sent from this screen."
        action={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {receipt && (
        <div className="mb-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 px-4 py-3 text-sm text-green-800 dark:text-green-300 flex justify-between gap-3">
          <p>{receipt}</p>
          <button type="button" className="text-xs underline" onClick={() => setReceipt(null)}>
            close
          </button>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Needs approval" value={summary.needs_approval} />
          <StatCard label="Approved, awaiting execution" value={summary.approved} />
          <StatCard label="Auto (source resolved)" value={summary.auto} />
          <StatCard label="Ignored" value={summary.ignore} />
          <StatCard label="Not classified" value={summary.untriaged} />
        </div>
      )}

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search name, phone, email, reason…">
        <select className={selectClass} value={triage} onChange={(e) => setTriage(e.target.value as VaTriage)}>
          {TRIAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FilterBar>

      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
        Showing {filtered.length} of {rows.length} loaded (newest sweep first, up to 200).
      </p>

      <DataTable columns={columns} data={filtered} emptyMessage={loading ? "Loading…" : "Nothing waiting in this bucket."} />

      <Modal
        open={pending !== null}
        onClose={() => { if (!saving) setPending(null); }}
        title={pending ? `${DECISION_LABEL[pending.decision]} — task #${pending.row.id}` : ""}
      >
        {pending && (
          <form onSubmit={submitDecision} className="space-y-4">
            <div className="text-sm">
              <div className="font-medium">{pending.row.subject_name || "Unnamed subject"}</div>
              <div className="text-gray-500 dark:text-slate-400">
                {pending.row.category} · {pending.row.agent} · {pending.row.triage_reason || "no reason recorded"}
              </div>
            </div>
            {pending.decision === "approve" && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Approval is recorded on the task only. No message, payment, or outreach is sent by this action.
              </p>
            )}
            <FormField label="Note (optional)">
              <textarea
                className={inputClass}
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why, or what was done"
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPending(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant={pending.decision === "dismiss" ? "danger" : "primary"} disabled={saving}>
                {saving ? "Saving…" : DECISION_LABEL[pending.decision]}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
