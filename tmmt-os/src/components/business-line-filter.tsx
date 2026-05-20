"use client";

import Link from "next/link";
import { TMMT_BUSINESS_LINES } from "@/lib/business-lines/registry";
import { cn } from "@/lib/utils";

export function BusinessLineFilter({
  active,
  activeStatus,
}: {
  active?: string;
  activeStatus?: string;
}) {
  const statusQuery = activeStatus ? `status=${activeStatus}&` : "";

  return (
    <div className="flex flex-wrap gap-1.5">
      <Link
        href={
          activeStatus ? `/internal/cases?status=${activeStatus}` : "/internal/cases"
        }
        className={cn(
          "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
          !active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border/80 bg-card text-muted-foreground hover:bg-muted"
        )}
      >
        All lines
      </Link>
      {TMMT_BUSINESS_LINES.map((line) => {
        const isActive = active === line.id;
        return (
          <Link
            key={line.id}
            href={`/internal/cases?${statusQuery}line=${line.id}`}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/80 bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {line.shortName}
          </Link>
        );
      })}
    </div>
  );
}
