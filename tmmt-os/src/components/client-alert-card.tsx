"use client";

import { Bell, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { acknowledgeAlert } from "@/app/(client)/client/rental/actions";
import { formatDate } from "@/lib/utils";

export function ClientAlertCard({
  alert,
}: {
  alert: {
    id: string;
    title: string;
    message: string;
    priority: string;
    due_at: string | null;
    alert_type: string;
  };
}) {
  const high = alert.priority === "high";

  return (
    <div
      className={cn(
        "surface-card flex gap-3 p-4",
        high && "ring-1 ring-amber-200/80 bg-amber-50/40"
      )}
    >
      <div className={cn("mt-0.5 rounded-lg p-2", high ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary")}>
        {high ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{alert.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{alert.message}</p>
        {alert.due_at && (
          <p className="mt-2 text-xs text-muted-foreground">Due by {formatDate(alert.due_at)}</p>
        )}
        <form
          action={async () => {
            await acknowledgeAlert(alert.id);
          }}
          className="mt-3"
        >
          <Button type="submit" variant="outline" size="sm" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Got it
          </Button>
        </form>
      </div>
    </div>
  );
}
