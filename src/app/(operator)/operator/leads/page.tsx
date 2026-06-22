"use client";

import { useEffect, useMemo, useState } from "react";
import { getAvailableLeads, getMyLeads, type LeadPoolRow } from "@/lib/queries";
import {
  PageHeader,
  DataTable,
  FilterBar,
  Modal,
  Button,
  ErrorBanner,
  StatusBadge,
  FormField,
  selectClass,
  type Column,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import {
  claimLeadAction,
  assignLeadAction,
  crossReferLeadAction,
  viewerContext,
  listOrgsForAssign,
} from "./actions";

type OrgOpt = { id: string; name: string };

type Tab = "available" | "mine";

export default function OperatorLeadsPage() {
  const [tab, setTab] = useState<Tab>("available");
  const [rows, setRows] = useState<LeadPoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [selected, setSelected] = useState<LeadPoolRow | null>(null);

  // Async fetch only (no synchronous setState) — safe to call from an effect.
  function fetchInto(which: Tab) {
    const fetcher = which === "available" ? getAvailableLeads : getMyLeads;
    return fetcher()
      .then(setRows)
      .catch(() => setError("Could not load leads."))
      .finally(() => setLoading(false));
  }

  // Called from event handlers — shows the spinner, then fetches.
  function load(which: Tab) {
    setLoading(true);
    void fetchInto(which);
  }

  useEffect(() => {
    viewerContext().then((v) => setCanManage(v.canManage)).catch(() => {});
    void fetchInto("available"); // loading already starts true
  }, []);

  function switchTab(t: Tab) {
    if (t === tab) return;
    setTab(t);
    load(t);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.contact_name, r.phone, r.email, r.source, r.campaign, r.vertical]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  async function handleClaim(row: LeadPoolRow) {
    setError(null);
    setBusyId(row.pool_id);
    const res = await claimLeadAction(row.pool_id);
    setBusyId(null);
    if (!res.success) {
      setError(res.error);
      load(tab); // someone may have taken it — refresh the list
      return;
    }
    load(tab);
  }

  const contactCell = (r: LeadPoolRow) => (
    <div>
      <p className="font-medium text-gray-900 dark:text-white">{r.contact_name ?? "—"}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{r.phone ?? "—"}</p>
    </div>
  );

  const availableColumns: Column<LeadPoolRow>[] = [
    { key: "vertical", label: "Vertical", render: (r) => <StatusBadge status={r.vertical} /> },
    { key: "contact_name", label: "Contact", render: contactCell },
    { key: "source", label: "Source", render: (r) => r.campaign ?? r.source ?? "—" },
    { key: "created_at", label: "Age", render: (r) => formatDateTime(r.created_at) },
    {
      key: "action",
      label: "",
      noExport: true,
      render: (r) => (
        <Button
          size="sm"
          onClick={() => handleClaim(r)}
          disabled={busyId === r.pool_id}
        >
          {busyId === r.pool_id ? "Claiming…" : "Claim"}
        </Button>
      ),
    },
  ];

  const mineColumns: Column<LeadPoolRow>[] = [
    { key: "vertical", label: "Vertical", render: (r) => <StatusBadge status={r.vertical} /> },
    { key: "contact_name", label: "Contact", render: contactCell },
    { key: "email", label: "Email", render: (r) => r.email ?? "—" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "claimed_at", label: "Claimed", render: (r) => (r.claimed_at ? formatDateTime(r.claimed_at) : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Claim available leads for your agency, then work the ones that are yours."
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-2">
        {(["available", "mine"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
              (tab === t
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800")
            }
          >
            {t === "available" ? "Available" : "My leads"}
          </button>
        ))}
      </div>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search leads…" />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" />
        </div>
      ) : (
        <DataTable
          columns={tab === "available" ? availableColumns : mineColumns}
          data={filtered}
          onRowClick={tab === "mine" ? (r) => setSelected(r) : undefined}
          emptyMessage={tab === "available" ? "No available leads right now." : "You haven't claimed any leads yet."}
        />
      )}

      {selected && (
        <LeadDetailModal
          row={selected}
          canManage={canManage}
          onClose={() => {
            setSelected(null);
            load(tab);
          }}
        />
      )}
    </div>
  );
}

function LeadDetailModal({
  row,
  canManage,
  onClose,
}: {
  row: LeadPoolRow;
  canManage: boolean;
  onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignOrg, setAssignOrg] = useState("");
  const [referAgency, setReferAgency] = useState("");
  const [referVertical, setReferVertical] = useState<"rentals" | "funding">("funding");
  const [operators, setOperators] = useState<OrgOpt[]>([]);
  const [agencies, setAgencies] = useState<OrgOpt[]>([]);

  useEffect(() => {
    if (!canManage) return;
    listOrgsForAssign()
      .then((o) => {
        setOperators(o.operators);
        setAgencies(o.agencies.filter((a) => a.id !== row.agency_org_id));
      })
      .catch(() => {});
  }, [canManage, row.agency_org_id]);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setErr(null);
    setSaving(true);
    const res = await fn();
    setSaving(false);
    if (!res.success) setErr(res.error ?? "Something went wrong.");
    else {
      setErr(null);
      alert(ok);
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title="Lead detail">
      <div className="space-y-3 text-sm">
        {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
        <Row label="Name" value={row.contact_name ?? "—"} />
        <Row label="Phone" value={row.phone ?? "—"} />
        <Row label="Email" value={row.email ?? "—"} />
        <Row label="Vertical" value={row.vertical} />
        <Row label="Source" value={row.campaign ?? row.source ?? "—"} />
        <Row label="Status" value={row.status} />

        {canManage && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Agency tools
            </p>

            <div className="space-y-2">
              <FormField label="Assign to operator">
                <select className={selectClass} value={assignOrg} onChange={(e) => setAssignOrg(e.target.value)}>
                  <option value="">Select an operator…</option>
                  {operators.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <Button
                size="sm"
                variant="secondary"
                disabled={saving || !assignOrg}
                onClick={() => run(() => assignLeadAction(row.pool_id, assignOrg), "Lead assigned.")}
              >
                Assign
              </Button>
            </div>

            <div className="space-y-2">
              <FormField label="Refer to other agency">
                <select className={selectClass} value={referAgency} onChange={(e) => setReferAgency(e.target.value)}>
                  <option value="">Select an agency…</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Their vertical">
                <select
                  className={selectClass}
                  value={referVertical}
                  onChange={(e) => setReferVertical(e.target.value as "rentals" | "funding")}
                >
                  <option value="funding">funding</option>
                  <option value="rentals">rentals</option>
                </select>
              </FormField>
              <Button
                size="sm"
                variant="secondary"
                disabled={saving || !referAgency}
                onClick={() =>
                  run(
                    () => crossReferLeadAction(row.pool_id, referAgency, referVertical),
                    "Lead referred."
                  )
                }
              >
                Refer
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 dark:text-slate-400">{label}</span>
      <span className="text-gray-900 dark:text-white text-right">{value}</span>
    </div>
  );
}
