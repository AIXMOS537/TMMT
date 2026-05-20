"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncMarketingKpiFromGhlAction } from "@/lib/marketing-kpi/actions";

export function GhlKpiSyncButton({
  weekStart,
  lastSyncedAt,
}: {
  weekStart: string;
  lastSyncedAt?: string | null;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => start(() => syncMarketingKpiFromGhlAction(weekStart))}
      >
        {pending ? "Pulling from GHL…" : "Pull from GHL"}
      </Button>
      {lastSyncedAt && (
        <p className="text-xs text-muted-foreground">
          GHL synced {new Date(lastSyncedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
