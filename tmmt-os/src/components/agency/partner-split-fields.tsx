"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  PARTNER_SEGMENT_LABELS,
  PASSIVE_DEFAULT_TIER,
  RETAIL_DEFAULT_TIER,
  type PartnerClientSegment,
  type PartnerRevenueSplitTier,
} from "@/lib/revenue-split/types";
import { formatSplitLabel, tiersForSegment } from "@/lib/revenue-split/resolve";

const selectClass =
  "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type Props = {
  idPrefix?: string;
  defaultSegment?: PartnerClientSegment;
  defaultTier?: string;
  defaultOwnSystem?: boolean;
  defaultVehicles?: number;
};

function defaultTierForSegment(
  segment: PartnerClientSegment,
  tier?: string
): PartnerRevenueSplitTier {
  const allowed = tiersForSegment(segment);
  if (tier && (allowed as readonly string[]).includes(tier)) {
    return tier as PartnerRevenueSplitTier;
  }
  return segment === "retail" ? RETAIL_DEFAULT_TIER : PASSIVE_DEFAULT_TIER;
}

export function PartnerSplitFields({
  idPrefix = "",
  defaultSegment = "retail",
  defaultTier,
  defaultOwnSystem = false,
  defaultVehicles = 0,
}: Props) {
  const p = idPrefix ? `${idPrefix}-` : "";
  const [segment, setSegment] = useState<PartnerClientSegment>(defaultSegment);
  const tierOptions = useMemo(() => tiersForSegment(segment), [segment]);
  const [tier, setTier] = useState<PartnerRevenueSplitTier>(() =>
    defaultTierForSegment(defaultSegment, defaultTier)
  );

  const isRetail = segment === "retail";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <Label htmlFor={`${p}partner_client_segment`}>Partner type</Label>
        <select
          id={`${p}partner_client_segment`}
          name="partner_client_segment"
          value={segment}
          onChange={(e) => {
            const next = e.target.value as PartnerClientSegment;
            setSegment(next);
            setTier(defaultTierForSegment(next));
          }}
          className={selectClass}
        >
          <option value="retail">{PARTNER_SEGMENT_LABELS.retail}</option>
          <option value="business_owner">{PARTNER_SEGMENT_LABELS.business_owner}</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          {isRetail
            ? "Own system + TMMT management · partner keeps more at higher tiers (90/10–70/30)."
            : "Hands-off · TMMT keeps more at 50/50 (default) or 60/40."}
        </p>
      </div>
      <div>
        <Label htmlFor={`${p}partner_revenue_split_tier`}>Revenue split</Label>
        <select
          id={`${p}partner_revenue_split_tier`}
          name="partner_revenue_split_tier"
          value={tier}
          onChange={(e) => setTier(e.target.value as PartnerRevenueSplitTier)}
          className={selectClass}
        >
          {tierOptions.map((t) => (
            <option key={t} value={t}>
              {formatSplitLabel(t)} partner / TMMT
            </option>
          ))}
        </select>
      </div>
      {isRetail ? (
        <>
          <div>
            <Label htmlFor={`${p}partner_qualified_vehicle_count`}>Fleet size (optional)</Label>
            <input
              id={`${p}partner_qualified_vehicle_count`}
              name="partner_qualified_vehicle_count"
              type="number"
              min={0}
              defaultValue={defaultVehicles}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Context only — not required for retail tiers.
            </p>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="partner_has_own_system"
                defaultChecked={defaultOwnSystem}
                className="rounded border-input"
              />
              Has own system
            </label>
          </div>
        </>
      ) : (
        <div className="sm:col-span-2">
          <input type="hidden" name="partner_qualified_vehicle_count" value={defaultVehicles} />
          <p className="text-xs text-muted-foreground">
            Passive partners are always eligible for 60/40 and 50/50 — no vehicle count or capital
            requirement.
          </p>
        </div>
      )}
    </div>
  );
}
