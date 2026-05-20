"use client";

import { FormEvent, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveMarketingKpiWeekAction } from "@/lib/marketing-kpi/actions";

const FIELDS = [
  { name: "followers", label: "New followers (total)" },
  { name: "reel_views", label: "Reel / TikTok views" },
  { name: "story_views", label: "Story views" },
  { name: "dm_started", label: "DM conversations started" },
  { name: "calls_booked", label: "Strategy calls booked" },
  { name: "new_subscribers", label: "New $97 subscribers" },
  { name: "email_list_growth", label: "Email / VIP list growth" },
] as const;

export function KpiWeekForm({
  defaultWeekStart,
  defaults,
  canEdit,
}: {
  defaultWeekStart: string;
  defaults?: Record<string, number>;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    start(() => saveMarketingKpiWeekAction(new FormData(e.currentTarget)));
  }

  return (
    <form onSubmit={onSubmit} className="surface-card space-y-4 p-5">
      <h2 className="text-lg font-medium">Log week</h2>
      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Ops/admin can submit numbers. You have read-only access.
        </p>
      )}
      <div>
        <Label htmlFor="week_start">Week starting (Monday)</Label>
        <Input
          id="week_start"
          name="week_start"
          type="date"
          required
          defaultValue={defaultWeekStart}
          readOnly={!canEdit}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ name, label }) => (
          <div key={name}>
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              name={name}
              type="number"
              min={0}
              required
              defaultValue={defaults?.[name] ?? 0}
              readOnly={!canEdit}
            />
          </div>
        ))}
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} readOnly={!canEdit} />
      </div>
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save week"}
        </Button>
      )}
    </form>
  );
}
