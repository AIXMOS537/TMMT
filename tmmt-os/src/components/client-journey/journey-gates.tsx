import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyHub } from "@/lib/client-journey/types";

export function JourneyGates({ hub }: { hub: JourneyHub }) {
  const items = [
    {
      label: "Credit path (A or B)",
      done: hub.gates.basePathSatisfied,
      detail: "Active $97/mo enrollment or payment plan paid in full",
    },
    {
      label: "Credit education",
      done: hub.gates.educationComplete,
      detail: "All required sections acknowledged",
    },
    {
      label: "Core training",
      done: hub.gates.trainingComplete,
      detail: `${hub.training.coreDone} / ${hub.training.coreTotal} modules complete`,
    },
    {
      label: "90-day good standing",
      done: hub.gates.day90GoodStanding,
      detail: hub.journey
        ? `${hub.journey.good_standing_days} days tracked`
        : "Rental payments current",
    },
    {
      label: "Lease-to-own eligible",
      done: hub.lto.eligible,
      detail: hub.lto.eligible ? "All gates met" : "Complete items above",
    },
  ];

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.label}
          className={cn(
            "flex gap-3 rounded-lg border p-4",
            item.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
          )}
        >
          {item.done ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">{item.label}</p>
            <p className="text-sm text-muted-foreground">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
