import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPrimaryPublicLine,
  listPublicIntakeLines,
  PRIMARY_PUBLIC_INTAKE_SLUG,
} from "@/lib/business-lines/registry";

const PORTALS = [
  {
    title: "Client Portal",
    desc: "Your rental, billing, maintenance, and documents.",
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

const rentals = getPrimaryPublicLine();
const otherLines = listPublicIntakeLines(true);
const featuredLines = otherLines.slice(0, 6);
const moreCount = Math.max(0, otherLines.length - featuredLines.length);

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between py-4">
          <h1 className="text-xl font-semibold tracking-tight">{rentals.name}</h1>
          <div className="flex items-center gap-2">
            <Link href="/internal/dashboard" className="hidden text-sm text-muted-foreground sm:inline hover:text-foreground">
              Command center
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container space-y-14 py-12 lg:py-16">
        <section
          className={cn(
            "max-w-3xl rounded-2xl bg-gradient-to-br p-8 ring-1 animate-fade-in",
            rentals.intake?.accent ?? "from-violet-500/15 border-violet-200/70"
          )}
        >
          <p className="text-sm font-medium text-muted-foreground">TMMT Command Center · public front door</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Rent a Tesla. Manage everything in one place.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{rentals.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/intake/${PRIMARY_PUBLIC_INTAKE_SLUG}`}>
              <Button size="lg">Book or request help</Button>
            </Link>
            <Link href="/client/rental">
              <Button size="lg" variant="outline">
                My rental
              </Button>
            </Link>
            <Link href="/client/dashboard">
              <Button size="lg" variant="ghost">
                Client portal
              </Button>
            </Link>
            <Link href="/track">
              <Button size="lg" variant="ghost">
                Track a request
              </Button>
            </Link>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Other TMMT businesses
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              More TMMT lines on the same command center — each has its own intake form when enabled.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredLines.map((line) => (
              <Link key={line.id} href={`/intake/${line.intake!.slug}`}>
                <Card
                  className={cn(
                    "h-full bg-gradient-to-br ring-1 transition-all hover:-translate-y-0.5 hover:shadow-lift",
                    line.intake?.accent
                  )}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{line.intake!.title}</CardTitle>
                    <CardDescription>{line.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm font-medium text-primary">Open form →</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
            <Link href="/intake">
              <Card className="h-full border-dashed transition-all hover:-translate-y-0.5 hover:shadow-lift">
                <CardHeader>
                  <CardTitle className="text-lg">All businesses</CardTitle>
                  <CardDescription>
                    {moreCount > 0
                      ? `${moreCount} more line${moreCount === 1 ? "" : "s"} plus rentals`
                      : "Full list including rentals"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-primary">View hub →</span>
                </CardContent>
              </Card>
            </Link>
          </div>
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

        <section className="rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Staff:</span> Operations, cases, GHL sync, and AI assign live in the{" "}
            <Link href="/internal/dashboard" className="text-primary underline">
              command center
            </Link>
            . One backend for ten customer-facing intake lines plus TMMT Management (staff).
          </p>
        </section>
      </div>
    </main>
  );
}
