import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listIntakeLines } from "@/lib/business-lines/registry";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function IntakeHubPage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            TMMT OS
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </div>

      <div className="container max-w-3xl space-y-8 py-12">
        <header className="space-y-2 animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight">Submit a request</h1>
          <p className="text-muted-foreground">
            Choose the business line first — each form only shows the options that apply there.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {listIntakeLines().map((line) => (
            <Link key={line.id} href={`/intake/${line.intake!.slug}`}>
              <Card
                className={cn(
                  "h-full bg-gradient-to-br ring-1 transition-all hover:-translate-y-0.5 hover:shadow-lift",
                  line.intake!.accent
                )}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{line.intake!.title}</CardTitle>
                  <CardDescription>{line.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {line.intake!.requestTypes.length} request type
                    {line.intake!.requestTypes.length === 1 ? "" : "s"}
                  </p>
                  <span className="mt-3 inline-block text-sm font-medium text-primary">
                    Open form →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
