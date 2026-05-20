"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveDailyCooBriefingAction,
  saveWeeklyCooBriefingAction,
} from "@/lib/coo-briefing/actions";
import type { CooBriefing } from "@/lib/coo-briefing/types";

export function CooBriefingPanel({
  today,
  daily,
  weekly,
}: {
  today: string;
  daily: CooBriefing | null;
  weekly: CooBriefing | null;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        className="surface-card space-y-4 p-5"
        action={(fd) => start(() => saveDailyCooBriefingAction(fd))}
      >
        <h2 className="text-lg font-medium">Daily briefing (9AM)</h2>
        <p className="text-xs text-muted-foreground">
          COO → Founder. Pipeline health, escalations, director sync, blockers.
        </p>
        <input type="hidden" name="briefing_date" value={today} />
        <div>
          <Label htmlFor="pipeline_health">Pipeline health</Label>
          <Textarea
            id="pipeline_health"
            name="pipeline_health"
            rows={3}
            defaultValue={daily?.pipeline_health ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="escalations">Escalations</Label>
          <Textarea
            id="escalations"
            name="escalations"
            rows={2}
            defaultValue={daily?.escalations ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="director_sync">Director sync notes</Label>
          <Textarea
            id="director_sync"
            name="director_sync"
            rows={2}
            defaultValue={daily?.director_sync ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="blockers">Blockers</Label>
          <Textarea id="blockers" name="blockers" rows={2} defaultValue={daily?.blockers ?? ""} />
        </div>
        <div>
          <Label htmlFor="loom_url_daily">Loom URL (optional)</Label>
          <Input
            id="loom_url_daily"
            name="loom_url"
            type="url"
            defaultValue={daily?.loom_url ?? ""}
            placeholder="https://loom.com/..."
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save daily briefing"}
        </Button>
      </form>

      <form
        className="surface-card space-y-4 p-5"
        action={(fd) => start(() => saveWeeklyCooBriefingAction(fd))}
      >
        <h2 className="text-lg font-medium">Weekly ops summary</h2>
        <p className="text-xs text-muted-foreground">
          Submit by Monday 10AM — ties to marketing KPI week.
        </p>
        <div>
          <Label htmlFor="briefing_date_weekly">Week ending</Label>
          <Input
            id="briefing_date_weekly"
            name="briefing_date"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div>
          <Label htmlFor="weekly_summary">Summary</Label>
          <Textarea
            id="weekly_summary"
            name="weekly_summary"
            rows={8}
            required
            defaultValue={weekly?.weekly_summary ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="loom_url_weekly">Loom URL (optional)</Label>
          <Input
            id="loom_url_weekly"
            name="loom_url"
            type="url"
            defaultValue={weekly?.loom_url ?? ""}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save weekly briefing"}
        </Button>
      </form>
    </div>
  );
}
