"use client";

import { useState, useTransition } from "react";
import { updateOrganizationPartnerSplit } from "@/lib/agency/partner-split-actions";
import { PartnerSplitFields } from "@/components/agency/partner-split-fields";
import { formatPartnerSegmentLabel, formatSplitLabel } from "@/lib/revenue-split/resolve";
import type { PartnerClientSegment, PartnerRevenueSplitTier } from "@/lib/revenue-split/types";
import { Button } from "@/components/ui/button";

type Props = {
  orgId: string;
  orgName: string;
  segment: PartnerClientSegment | null;
  tier: PartnerRevenueSplitTier | null;
  hasOwnSystem: boolean;
  vehicleCount: number;
};

export function PartnerSplitEditor({
  orgId,
  orgName,
  segment,
  tier,
  hasOwnSystem,
  vehicleCount,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const label =
    segment && tier
      ? `${formatSplitLabel(tier)} · ${formatPartnerSegmentLabel(segment)}`
      : "Not set";

  return (
    <div className="text-sm">
      <button
        type="button"
        className="text-primary hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <form
          className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3"
          action={(fd) => {
            setError(null);
            start(async () => {
              const res = await updateOrganizationPartnerSplit(orgId, fd);
              if (!res.success) setError(res.error);
              else setOpen(false);
            });
          }}
        >
          <p className="text-xs font-medium">{orgName}</p>
          <PartnerSplitFields
            idPrefix={orgId.slice(0, 8)}
            defaultSegment={segment ?? "retail"}
            defaultTier={tier ?? undefined}
            defaultOwnSystem={hasOwnSystem}
            defaultVehicles={vehicleCount}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save split"}
          </Button>
        </form>
      )}
    </div>
  );
}
