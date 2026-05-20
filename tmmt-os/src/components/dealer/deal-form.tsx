"use client";

import { useState, useTransition } from "react";
import { saveDealAction } from "@/lib/dealer/actions";
import { DEAL_STATUSES } from "@/lib/dealer/types";
import type { DealRow } from "@/lib/dealer/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PartyOption = { id: string; full_name: string };
type VehicleOption = { id: string; label: string; vin: string | null };

export function DealForm({
  deal,
  parties,
  vehicles,
}: {
  deal?: DealRow | null;
  parties: PartyOption[];
  vehicles: VehicleOption[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="surface-card space-y-4 p-6"
      action={(fd) => {
        setError(null);
        start(async () => {
          const res = await saveDealAction(fd);
          if (!res.success) {
            setError(res.error);
            return;
          }
          if (res.id && !deal) {
            window.location.href = `/internal/dealer/deals/${res.id}`;
          } else {
            window.location.reload();
          }
        });
      }}
    >
      {deal?.id && <input type="hidden" name="id" value={deal.id} />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="party_id">Buyer</Label>
          <select
            id="party_id"
            name="party_id"
            defaultValue={deal?.party_id ?? ""}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Select buyer —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="fleet_vehicle_id">Vehicle (inventory)</Label>
          <select
            id="fleet_vehicle_id"
            name="fleet_vehicle_id"
            defaultValue={deal?.fleet_vehicle_id ?? ""}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Select unit —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="vehicle_label">Vehicle label</Label>
          <Input
            id="vehicle_label"
            name="vehicle_label"
            defaultValue={deal?.vehicle_label ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="vin">VIN</Label>
          <Input id="vin" name="vin" defaultValue={deal?.vin ?? ""} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={deal?.status ?? "working"}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {DEAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="sale_price">Sale price</Label>
          <Input
            id="sale_price"
            name="sale_price"
            type="number"
            step="0.01"
            defaultValue={deal?.sale_price ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="down_payment">Down payment</Label>
          <Input
            id="down_payment"
            name="down_payment"
            type="number"
            step="0.01"
            defaultValue={deal?.down_payment ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={deal?.notes ?? ""} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : deal ? "Update deal" : "Create deal"}
      </Button>
    </form>
  );
}
