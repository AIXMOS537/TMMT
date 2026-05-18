import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PORTALS = [
  {
    title: "Client Portal",
    desc: "Apps, training, documents, billing — by package.",
    href: "/client/dashboard",
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
    ring: "ring-violet-200/60",
  },
  {
    title: "Team Portal",
    desc: "SOPs, scripts, workflows, and internal training.",
    href: "/team/dashboard",
    gradient: "from-teal-500/15 via-teal-500/5 to-transparent",
    ring: "ring-teal-200/60",
  },
  {
    title: "Admin Dashboard",
    desc: "Users, packages, revenue, and access overrides.",
    href: "/admin/dashboard",
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    ring: "ring-amber-200/60",
  },
] as const;

const QUICK = [
  { title: "Learn", href: "/learn", label: "Browse" },
  { title: "Marketplace", href: "/marketplace", label: "Browse" },
  { title: "Onboarding", href: "/onboarding", label: "Start" },
  { title: "Submit a request", href: "/intake", label: "New intake", primary: true },
  { title: "Operations", href: "/internal/dashboard", label: "Open" },
  { title: "TMMT Management", href: "/internal/interfaces", label: "Open" },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between py-4">
          <h1 className="text-xl font-semibold tracking-tight">TMMT OS</h1>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </div>

      <div className="container space-y-14 py-12 lg:py-16">
        <section className="max-w-2xl animate-fade-in">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            One login. Color-coded ops.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            One product for portals and ops — with TMMT Management for appointments, contracts,
            fleet, and payments.
          </p>
        </section>

        <section className="space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Portals
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {PORTALS.map((p) => (
              <Card
                key={p.href}
                className={cn(
                  "overflow-hidden bg-gradient-to-br ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
                  p.gradient,
                  p.ring
                )}
              >
                <CardHeader>
                  <CardTitle>{p.title}</CardTitle>
                  <CardDescription>{p.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={p.href}>
                    <Button variant="outline" className="w-full">
                      Enter
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick links
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="surface-card flex items-center justify-between px-5 py-4"
              >
                <span className="font-medium">{c.title}</span>
                <span className="text-sm text-primary">{c.label} →</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
