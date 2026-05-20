"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createLtoAgreementAction,
  recordVehicleTurnoverAction,
} from "@/lib/client-journey/actions";

export function StaffLtoActions({
  email,
  ltoEligible,
}: {
  email: string;
  ltoEligible: boolean;
}) {
  const [pending, start] = useTransition();
  const [vin, setVin] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">LTO & vehicle</h3>
      {!ltoEligible && (
        <p className="text-xs text-amber-600">
          Client has not met all LTO gates yet — you can still draft paperwork.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">VIN (optional)</label>
          <Input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            placeholder="1HGBH41JXMN109186"
            className="mt-1 w-48"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => start(() => createLtoAgreementAction(email, vin || undefined))}
        >
          Create LTO agreement
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Turnover notes</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Swap completed at lot"
            className="mt-1 w-56"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => start(() => recordVehicleTurnoverAction(email, notes || undefined))}
        >
          Record vehicle turnover
        </Button>
      </div>
    </div>
  );
}
