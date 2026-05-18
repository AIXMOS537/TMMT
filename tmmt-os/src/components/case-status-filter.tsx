"use client";

import Link from "next/link";
import { CASE_STATUS_LABEL, CASE_STATUSES, type CaseStatus } from "@/lib/workflow/statuses";
import { getCaseStatusTone, toneStyles } from "@/lib/ui/status-colors";
import { cn } from "@/lib/utils";

export function CaseStatusFilter({ active }: { active?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Link
          href="/internal/cases"
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
            !active
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border/80 bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          All
        </Link>
        <div className="h-5 w-px bg-border/80" />
        <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {CASE_STATUSES.map((status) => {
            const tone = getCaseStatusTone(status);
            const s = toneStyles(tone);
            const isActive = active === status;
            return (
              <Link
                key={status}
                href={`/internal/cases?status=${status}`}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200",
                  isActive ? s.pillActive : s.pill
                )}
              >
                {CASE_STATUS_LABEL[status]}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
