"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { ViewSwitcher, useActiveView } from "@/components/view-switcher";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { RequestTypeBadge } from "@/components/request-type-badge";
import { CaseStatusFilter } from "@/components/case-status-filter";
import { CASE_STATUS_LABEL, type CaseStatus, type RequestType } from "@/lib/workflow/statuses";
import { getCaseStatusTone, toneStyles } from "@/lib/ui/status-colors";
import { formatDate, cn } from "@/lib/utils";

export type CaseRow = {
  id: string;
  ref_code: string;
  customer_name: string;
  request_type: string;
  subject: string;
  status: string;
  created_at: string;
};

const BOARD_COLUMNS: { label: string; statuses: CaseStatus[] }[] = [
  { label: "Intake", statuses: ["intake_submitted", "initial_contact_needed", "initial_contact_complete"] },
  { label: "Internal", statuses: ["internal_review", "task_assignment", "vendor_needed"] },
  { label: "Vendor", statuses: ["vendor_assigned", "vendor_in_progress", "vendor_completed"] },
  { label: "Closing", statuses: ["internal_quality_check", "customer_follow_up", "awaiting_approval", "completed", "closed"] },
  { label: "Blocked", statuses: ["blocked"] },
];

export function CasesWorkspace({
  cases,
  activeStatus,
}: {
  cases: CaseRow[];
  activeStatus?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useActiveView("board");

  useEffect(() => {
    if (searchParams.get("view")) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "list");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <div className="space-y-6 animate-fade-in">
      <ViewSwitcher
        tabs={[
          { key: "board", label: "Board", icon: <LayoutGrid className="h-4 w-4" /> },
          { key: "list", label: "List", icon: <List className="h-4 w-4" /> },
        ]}
      />

      <CaseStatusFilter active={activeStatus} />

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {BOARD_COLUMNS.map((col) => {
            const items = cases.filter((c) =>
              col.statuses.includes(c.status as CaseStatus)
            );
            const tone = getCaseStatusTone(col.statuses[0]);
            const s = toneStyles(tone);
            return (
              <div
                key={col.label}
                className="flex w-72 shrink-0 flex-col rounded-2xl border border-border/60 bg-card/80 shadow-soft"
              >
                <div className={cn("rounded-t-2xl border-b px-3 py-2.5", s.badge)}>
                  <p className="text-xs font-semibold">{col.label}</p>
                  <p className="text-[10px] opacity-80">{items.length} cases</p>
                </div>
                <ul className="flex max-h-[min(70vh,640px)] flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
                  {items.length === 0 && (
                    <li className="px-2 py-6 text-center text-xs text-muted-foreground">Empty</li>
                  )}
                  {items.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/internal/cases/${c.id}`}
                        className={cn(
                          "block rounded-xl border border-border/50 p-3 transition-all duration-200 hover:shadow-soft",
                          toneStyles(getCaseStatusTone(c.status as CaseStatus)).row
                        )}
                      >
                        <p className="text-sm font-medium leading-snug">{c.subject}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.ref_code} · {c.customer_name}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <CaseStatusBadge status={c.status as CaseStatus} />
                          <RequestTypeBadge type={c.request_type as RequestType} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Request</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const row = toneStyles(getCaseStatusTone(c.status as CaseStatus));
                  return (
                    <tr
                      key={c.id}
                      className={cn("border-b border-border/40 transition-colors hover:bg-muted/30", row.row)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link href={`/internal/cases/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.ref_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{c.customer_name}</td>
                      <td className="px-4 py-3">
                        <RequestTypeBadge type={c.request_type as RequestType} />
                      </td>
                      <td className="max-w-xs truncate px-4 py-3">{c.subject}</td>
                      <td className="px-4 py-3">
                        <CaseStatusBadge status={c.status as CaseStatus} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(c.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
