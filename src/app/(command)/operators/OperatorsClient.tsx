"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  DataTable,
  Button,
  Modal,
  FormField,
  ErrorBanner,
  StatusBadge,
  inputClass,
  selectClass,
  type Column,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import {
  listOperators,
  listOrgs,
  provisionOperatorSubAccount,
  fundOperatorTokens,
  type OperatorRow,
  type OrgOption,
} from "./actions";

export default function OperatorsClient() {
  const [rows, setRows] = useState<OperatorRow[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [funding, setFunding] = useState<OperatorRow | null>(null);

  function reload() {
    setLoading(true);
    listOperators()
      .then(setRows)
      .catch(() => setError("Could not load operators."))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    listOperators()
      .then(setRows)
      .catch(() => setError("Could not load operators."))
      .finally(() => setLoading(false));
    listOrgs().then(setOrgs).catch(() => {});
  }, []);

  const nameOf = (id: string | null) => orgs.find((o) => o.id === id)?.name ?? "—";

  const columns: Column<OperatorRow>[] = [
    { key: "name", label: "Operator" },
    { key: "parent_agency_id", label: "Agency", render: (r) => nameOf(r.parent_agency_id) },
    {
      key: "balance",
      label: "Tokens",
      render: (r) => (r.unlimited ? <StatusBadge status="unlimited" /> : r.balance.toLocaleString()),
    },
    { key: "created_at", label: "Created", render: (r) => formatDateTime(r.created_at) },
    {
      key: "fund",
      label: "",
      noExport: true,
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => setFunding(r)}>
          Fund
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operators"
        description="Provision operator sub-accounts under an agency and fund their TMMT tokens."
        action={<Button onClick={() => setShowNew(true)}>Provision operator</Button>}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" />
        </div>
      ) : (
        <DataTable columns={columns} data={rows} emptyMessage="No operator sub-accounts yet." />
      )}

      {showNew && (
        <NewOperatorModal
          orgs={orgs}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            reload();
          }}
        />
      )}
      {funding && (
        <FundModal
          row={funding}
          onClose={() => setFunding(null)}
          onDone={() => {
            setFunding(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function NewOperatorModal({
  orgs,
  onClose,
  onDone,
}: {
  orgs: OrgOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  // An agency is a top-level org. Sub-accounts (those with a parent) cannot
  // themselves be parents — that would nest operators under operators.
  const agencies = orgs.filter((o) => o.parent_agency_id === null);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [tokens, setTokens] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setErr(null);
    setSaving(true);
    const res = await provisionOperatorSubAccount({
      name,
      parentAgencyOrgId: parent,
      initialTokens: Number(tokens) || 0,
    });
    setSaving(false);
    if (!res.success) setErr(res.error);
    else onDone();
  }

  return (
    <Modal open onClose={onClose} title="Provision operator">
      <div className="space-y-4">
        {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
        <FormField label="Operator name" required>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. North VA Rentals — J. Doe" />
        </FormField>
        <FormField label="Parent agency" required>
          <select className={selectClass} value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Select an agency…</option>
            {agencies.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Initial token grant">
          <input className={inputClass} type="number" min={0} value={tokens} onChange={(e) => setTokens(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim() || !parent}>
            {saving ? "Provisioning…" : "Provision"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FundModal({ row, onClose, onDone }: { row: OperatorRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("100");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setErr(null);
    setSaving(true);
    const res = await fundOperatorTokens({ orgId: row.id, amount: Number(amount) || 0 });
    setSaving(false);
    if (!res.success) setErr(res.error);
    else onDone();
  }

  return (
    <Modal open onClose={onClose} title={`Fund tokens — ${row.name}`}>
      <div className="space-y-4">
        {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Current balance: {row.unlimited ? "Unlimited" : row.balance.toLocaleString()}
        </p>
        <FormField label="Tokens to add" required>
          <input className={inputClass} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !(Number(amount) > 0)}>
            {saving ? "Funding…" : "Add tokens"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
