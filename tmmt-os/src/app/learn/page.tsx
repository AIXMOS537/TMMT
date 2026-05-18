import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MODULES = [
  {
    title: "TMMT ecosystem overview",
    description: "How rentals, ops cases, vendors, and investors connect in TMMT OS.",
    status: "available",
  },
  {
    title: "Operator playbook",
    description: "Intake → case → vendor assignment → quality check → close.",
    status: "available",
  },
  {
    title: "Rental marketplace basics",
    description: "Bookings, vehicles, and CRM sync for the rentals line.",
    status: "coming_soon",
  },
  {
    title: "AIXMOS agent panel",
    description: "VISION, TANK, FLY GUY, BOB, and STICKS — 3-of-5 approval workflow.",
    status: "coming_soon",
  },
] as const;

export default function LearnPage() {
  return (
    <main className="min-h-screen container py-16 space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">AIXMOS · Education</p>
        <h1 className="text-4xl font-semibold">Learn</h1>
        <p className="text-muted-foreground max-w-2xl">
          Guided training for TMMT operators, vendors, and ecosystem partners. Modules expand as
          content is published from your Notion / LMS sources.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) => (
          <Card key={m.title}>
            <CardHeader>
              <CardTitle>{m.title}</CardTitle>
              <CardDescription>{m.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {m.status === "available" ? (
                <Button variant="outline" disabled className="w-full">
                  Open module (content wiring next)
                </Button>
              ) : (
                <span className="text-xs uppercase text-muted-foreground">Coming soon</span>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="flex gap-4">
        <Link href="/onboarding">
          <Button variant="outline">Start onboarding</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost">Back home</Button>
        </Link>
      </div>
    </main>
  );
}
