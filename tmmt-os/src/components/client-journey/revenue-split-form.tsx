"use client";

import { FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordRevenueSplitAction } from "@/lib/client-journey/actions";
export function RevenueSplitForm({
  defaultEmail = "",
  splitPreview,
}: {
  defaultEmail?: string;
  splitPreview?: { label: string; partnerPct: number; agencyPct: number } | null;
}) {
  const [pending, start] = useTransition();
  const [gross, setGross] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const partnerShare = splitPreview
    ? Math.round((gross * splitPreview.partnerPct) / 100) / 100
    : null;
  const agencyShare = splitPreview
    ? Math.round((gross * splitPreview.agencyPct) / 100) / 100
    : null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const grossCents = Math.round(Number(fd.get("gross_dollars") ?? 0) * 100);
    const periodStart = String(fd.get("period_start") ?? monthStart);
    const periodEnd = String(fd.get("period_end") ?? today);
    start(() => recordRevenueSplitAction(email, grossCents, periodStart, periodEnd));
  }

  return (
    <form onSubmit={onSubmit} className="surface-card max-w-lg space-y-3 p-5">
      <h3 className="text-sm font-medium">Record revenue split</h3>
      {splitPreview && (
        <p className="text-xs text-muted-foreground">
          Active split: <strong>{splitPreview.label}</strong> (partner {splitPreview.partnerPct}% /
          TMMT {splitPreview.agencyPct}%)
        </p>
      )}
      <div>
        <label className="text-xs text-muted-foreground">Operator / partner email</label>
        <Input name="email" type="email" required defaultValue={defaultEmail} className="mt-1" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Gross (USD)</label>
        <Input
          name="gross_dollars"
          type="number"
          min={0}
          step="0.01"
          required
          className="mt-1"
          onChange={(e) => setGross(Number(e.target.value) || 0)}
        />
        {splitPreview && gross > 0 && partnerShare != null && agencyShare != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Preview: partner {partnerShare.toLocaleString("en-US", { style: "currency", currency: "USD" })}{" "}
            · TMMT {agencyShare.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Period start</label>
          <Input name="period_start" type="date" defaultValue={monthStart} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Period end</label>
          <Input name="period_end" type="date" defaultValue={today} className="mt-1" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Add split row"}
      </Button>
    </form>
  );
}
