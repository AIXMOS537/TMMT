import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPrimaryPublicLine,
  listPublicIntakeLines,
  PRIMARY_PUBLIC_INTAKE_SLUG,
} from "@/lib/business-lines/registry";
import {
  getCommandCenterLabel,
  getHomeHeaderSubtitle,
  getHomeHeaderTitle,
  getTailorFeatures,
  getTailorHome,
  getTailorPortals,
} from "@/lib/tailor/config";

/**
 * The app's public front door. Ported from TMMT OS.
 *
 * Until now this app had no "/" at all: middleware sent every signed-out
 * visitor to /login (PR #223), which it did because the only alternative then
 * was bouncing them to the marketing site. That is why "/" is now public in
 * isPublicPath — this page is the front door that fix was waiting for.
 *
 * Links that exist in TMMT OS but not here were re-pointed, not carried over
 * dead: the portal cards come from config/tailor.json and now name /command,
 * /operator and /learn; the hero's "My rental", "Client portal" and "Track a
 * request" buttons are gone with the client portal, which is a later phase.
 */
const PORTAL_STYLES = [
  { gradient: "from-violet-500/15 via-violet-500/5 to-transparent", ring: "ring-violet-200/60" },
  { gradient: "from-teal-500/15 via-teal-500/5 to-transparent", ring: "ring-teal-200/60" },
  { gradient: "from-amber-500/15 via-amber-500/5 to-transparent", ring: "ring-amber-200/60" },
] as const;

export default function HomePage() {
  const rentals = getPrimaryPublicLine();
  const home = getTailorHome();
  const features = getTailorFeatures();
  const portalCards = getTailorPortals() ?? [];
  const otherLines = listPublicIntakeLines(true);
  const featuredLines = otherLines.slice(0, features.maxFeaturedBusinessLines);
  const moreCount = Math.max(0, otherLines.length - featuredLines.length);
  const headerTitle = getHomeHeaderTitle();
  const headerSubtitle = getHomeHeaderSubtitle();

  return (
    <main className="min-h-screen">
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 py-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{headerTitle}</h1>
            {headerSubtitle && (
              <p className="truncate text-xs text-muted-foreground">{headerSubtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/command"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
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

      <div className="mx-auto w-full max-w-5xl space-y-14 px-4 py-12 lg:py-16">
        <section
          className={cn(
            "max-w-3xl rounded-2xl bg-linear-to-br p-8 ring-1",
            rentals.intake?.accent ?? "from-violet-500/15 border-violet-200/70"
          )}
        >
          <p className="text-sm font-medium text-muted-foreground">
            {home.eyebrow ?? `${getCommandCenterLabel()} · public front door`}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {home.headline ?? "Rent a Tesla. Manage everything in one place."}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {rentals.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/intake/${PRIMARY_PUBLIC_INTAKE_SLUG}`}>
              <Button size="lg">{home.primaryCta ?? "Book or request help"}</Button>
            </Link>
            <Link href="/intake">
              <Button size="lg" variant="outline">
                All request forms
              </Button>
            </Link>
          </div>
        </section>

        {features.showOtherBusinesses && (
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {home.otherBusinessesTitle ?? "Other TMMT businesses"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {home.otherBusinessesDescription ??
                  "More TMMT lines on the same command center — each has its own intake form when enabled."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredLines.map((line) => (
                <Link key={line.id} href={`/intake/${line.intake!.slug}`}>
                  <Card
                    className={cn(
                      "h-full bg-linear-to-br ring-1 transition-transform hover:-translate-y-0.5",
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
                <Card className="h-full border-dashed transition-transform hover:-translate-y-0.5">
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
        )}

        {features.showPortalsSection && portalCards.length > 0 && (
          <section className="space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Portals
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              {portalCards.map((p, i) => {
                const style = PORTAL_STYLES[i % PORTAL_STYLES.length];
                return (
                  <Card
                    key={p.href}
                    className={cn(
                      "overflow-hidden bg-linear-to-br ring-1 transition-transform hover:-translate-y-0.5",
                      style.gradient,
                      style.ring
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{p.title}</CardTitle>
                      <CardDescription>{p.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={p.href}>
                        <Button variant="outline" className="w-full">
                          Enter
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Staff:</span>{" "}
            {home.staffNote ?? (
              <>
                Operations, cases, GHL sync, and AI assign live in the{" "}
                <Link href="/command" className="text-primary underline">
                  command center
                </Link>
                .
              </>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
