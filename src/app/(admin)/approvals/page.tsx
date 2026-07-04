"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PageHeader,
  DataTable,
  Column,
  StatusBadge,
  Button,
  ErrorBanner,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { ShieldCheck, Check, X } from "lucide-react";
import { describeActionType, type DbGatedAction } from "@/lib/approvals-core";
import { listPendingApprovals, decideApproval } from "./actions";

/** Owner-approval console — the driver's seat. Nothing outbound (message, charge,
 *  dispute, payout) executes until an owner approves it here. */
export default function ApprovalsPage() {
  const [actions, setActions] = useState<DbGatedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listPendingApprovals()
      .then((res) => {
        if (res.success) setActions(res.actions);
        else setError(res.error);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load pending approvals.");
        setLoading(false);
      });
  }, []);
  useEffect(load, [load]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusyId(id);
    setError(null);
    const reason =
      decision === "reject"
        ? window.prompt("Reason for rejecting (optional):") ?? undefined
        : undefined;
    const res = await decideApproval(id, decision, reason);
    setBusyId(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    load();
  };

  const columns: Column<DbGatedAction>[] = [
    {
      key: "type",
      label: "Action",
      render: (r) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {describeActionType(r.type)}
        </span>
      ),
    },
    { key: "created_by", label: "Requested by" },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "created_at",
      label: "Requested",
      render: (r) => (
        <span className="text-sm">{formatDate(r.created_at)}</span>
      ),
    },
    {
      key: "payload",
      label: "Details",
      csvValue: (r) => JSON.stringify(r.payload),
      render: (r) => (
        <span className="text-sm truncate max-w-[280px] block text-gray-600 dark:text-gray-300">
          {JSON.stringify(r.payload)}
        </span>
      ),
    },
    {
      key: "id",
      label: "Decision",
      noExport: true,
      render: (r) => (
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => decide(r.id, "approve")}
            disabled={busyId === r.id}
          >
            <Check size={15} />
            Approve
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={() => decide(r.id, "reject")}
            disabled={busyId === r.id}
          >
            <X size={15} />
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Owner Approvals"
        description={`${actions.length} pending — nothing sends, charges, disputes, or pays out until you approve it here`}
        action={
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <ShieldCheck size={16} />
            Owner-approval gate
          </div>
        }
      />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : actions.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <ShieldCheck size={32} className="mx-auto mb-3 opacity-60" />
          <p className="font-medium">Queue clear.</p>
          <p className="text-sm">No actions are waiting on your approval.</p>
        </div>
      ) : (
        <DataTable columns={columns} data={actions} />
      )}
    </div>
  );
}
