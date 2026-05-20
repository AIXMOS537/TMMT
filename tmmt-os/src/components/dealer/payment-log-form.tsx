"use client";

import { useState, useTransition } from "react";
import { logDealPaymentAction } from "@/lib/dealer/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaymentLogForm({ dealId }: { dealId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-t pt-4"
      action={(fd) => {
        fd.set("deal_id", dealId);
        setError(null);
        start(async () => {
          const res = await logDealPaymentAction(fd);
          if (!res.success) {
            setError(res.error);
            return;
          }
          window.location.reload();
        });
      }}
    >
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" type="number" step="0.01" required className="mt-1 w-28" />
      </div>
      <div>
        <Label htmlFor="method">Method</Label>
        <select
          id="method"
          name="method"
          defaultValue="cash"
          className="mt-1 flex h-10 w-32 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="card">Card</option>
          <option value="ach">ACH</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Logging…" : "Log payment"}
      </Button>
    </form>
  );
}
