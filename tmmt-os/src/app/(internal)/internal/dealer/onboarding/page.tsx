import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  advanceOnboardingStep,
  getOnboardingState,
  saveOnboardingOrgName,
} from "@/lib/dealer/onboarding-actions";

export const dynamic = "force-dynamic";

const STEPS = [
  { id: "org", title: "Dealership profile", description: "Name your lot and set vertical to dealer." },
  {
    id: "inventory",
    title: "Inventory",
    description: "Add vehicles in Command Center or sync from your existing feed.",
  },
  {
    id: "first_deal",
    title: "First deal",
    description: "Log a buyer and deal on the deal desk to validate collections.",
  },
  { id: "complete", title: "Go live", description: "Mark setup complete and open the dashboard." },
] as const;

function stepIndex(step: string) {
  const order = ["not_started", "org", "inventory", "first_deal", "complete"];
  return order.indexOf(step);
}

export default async function DealerOnboardingPage() {
  const state = await getOnboardingState();
  const current = stepIndex(state.step);
  const completed = state.completed;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="LotOS setup wizard"
        description="Pilot checklist — finish these steps before your first customer walk-in."
      />

      {!state.bridgeReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Command Center bridge is not configured. Set COMMAND_CENTER_SUPABASE_URL and
          COMMAND_CENTER_SUPABASE_SERVICE_KEY to load inventory and leads.
        </p>
      )}

      {completed ? (
        <div className="surface-card space-y-4 p-6 text-center">
          <p className="font-medium">Setup complete</p>
          <Link href="/internal/dealer" className={cn(buttonVariants())}>
            Open dealer dashboard
          </Link>
        </div>
      ) : (
        <ol className="space-y-4">
          {STEPS.map((s, i) => {
            const active = current === i || (state.step === "not_started" && s.id === "org");
            const done = current > i;
            return (
              <li
                key={s.id}
                className={`surface-card p-6 ${active ? "ring-2 ring-primary" : done ? "opacity-70" : "opacity-50"}`}
              >
                <p className="text-xs uppercase text-muted-foreground">
                  Step {i + 1} {done ? "· done" : active ? "· current" : ""}
                </p>
                <h2 className="mt-1 font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>

                {active && s.id === "org" && (
                  <form action={saveOnboardingOrgName} className="mt-4 space-y-3">
                    <div>
                      <Label htmlFor="name">Dealership name</Label>
                      <Input
                        id="name"
                        name="name"
                        required
                        defaultValue={state.orgName ?? ""}
                        className="mt-1 max-w-sm"
                        placeholder="Main Street Motors"
                      />
                    </div>
                    <Button type="submit">Save and continue</Button>
                  </form>
                )}

                {active && s.id === "inventory" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/internal/dealer/inventory" className={cn(buttonVariants())}>
                      Open inventory
                    </Link>
                    <form action={async () => advanceOnboardingStep("first_deal")}>
                      <Button type="submit" variant="outline">
                        Skip for now
                      </Button>
                    </form>
                  </div>
                )}

                {active && s.id === "first_deal" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/internal/dealer/deals/new" className={cn(buttonVariants())}>
                      Create first deal
                    </Link>
                    <form action={async () => advanceOnboardingStep("complete")}>
                      <Button type="submit" variant="outline">
                        I will add deals later
                      </Button>
                    </form>
                  </div>
                )}

                {active && s.id === "complete" && (
                  <form action={async () => advanceOnboardingStep("complete")} className="mt-4">
                    <Button type="submit">Mark setup complete</Button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
