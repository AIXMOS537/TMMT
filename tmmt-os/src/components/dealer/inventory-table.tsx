"use client";

import { useState, useTransition } from "react";
import { upsertFleetAction } from "@/lib/dealer/actions";
import type { DealerFleetRow } from "@/lib/dealer/types";
import { RETAIL_STATUSES } from "@/lib/dealer/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function InventoryTable({ rows }: { rows: DealerFleetRow[] }) {
  const [editing, setEditing] = useState<DealerFleetRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (formData: FormData) => {
    setError(null);
    start(async () => {
      const record: Record<string, unknown> = {};
      formData.forEach((v, k) => {
        if (k === "id" && v) record.id = v;
        else if (["acquisition_cost", "list_price", "year", "mileage"].includes(k)) {
          const n = Number(v);
          record[k] = v && Number.isFinite(n) ? n : null;
        } else record[k] = v || null;
      });
      const res = await upsertFleetAction(record);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setEditing(null);
      window.location.reload();
    });
  };

  if (editing) {
    return (
      <form action={save} className="surface-card space-y-4 p-6">
        <input type="hidden" name="id" value={editing.id} />
        <h3 className="font-semibold">Edit inventory unit</h3>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="vehicle_name">Display name</Label>
            <Input id="vehicle_name" name="vehicle_name" defaultValue={editing.vehicle_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="retail_status">Retail status</Label>
            <select
              id="retail_status"
              name="retail_status"
              defaultValue={editing.retail_status ?? "available"}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {RETAIL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="acquisition_cost">Acquisition cost</Label>
            <Input
              id="acquisition_cost"
              name="acquisition_cost"
              type="number"
              step="0.01"
              defaultValue={editing.acquisition_cost ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="list_price">List price</Label>
            <Input
              id="list_price"
              name="list_price"
              type="number"
              step="0.01"
              defaultValue={editing.list_price ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="vin_number">VIN</Label>
            <Input id="vin_number" name="vin_number" defaultValue={editing.vin_number ?? ""} />
          </div>
          <div>
            <Label htmlFor="vehicle_status">Rental status (legacy)</Label>
            <Input
              id="vehicle_status"
              name="vehicle_status"
              defaultValue={editing.vehicle_status ?? ""}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vehicle</TableHead>
          <TableHead>Retail</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>List</TableHead>
          <TableHead>Gross est.</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-muted-foreground">
              No vehicles — connect Command Center or add fleet rows.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => {
            const gross =
              r.list_price != null && r.acquisition_cost != null
                ? r.list_price - r.acquisition_cost
                : null;
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="font-medium">{r.vehicle_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ")}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.retail_status ?? "—"}</Badge>
                </TableCell>
                <TableCell>{r.acquisition_cost != null ? `$${r.acquisition_cost}` : "—"}</TableCell>
                <TableCell>{r.list_price != null ? `$${r.list_price}` : "—"}</TableCell>
                <TableCell>{gross != null ? `$${gross.toFixed(0)}` : "—"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
