import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const supabase = createSupabaseServerClient();

  const [{ data: services, error: servicesErr }, { data: vehicles, error: vehiclesErr }] =
    await Promise.all([
      supabase
        .from("services")
        .select("slug, name, description, category")
        .eq("active", true)
        .order("name"),
      supabase
        .from("vehicles")
        .select("id, label, make, model, year, daily_rate")
        .eq("active", true)
        .order("label")
        .limit(12),
    ]);

  const migrationNeeded =
    servicesErr?.message.includes("does not exist") ||
    vehiclesErr?.message.includes("does not exist");

  return (
    <main className="min-h-screen container py-16 space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">TMMT Rentals</p>
        <h1 className="text-4xl font-semibold">Marketplace</h1>
        <p className="text-muted-foreground max-w-2xl">
          Browse services and available vehicles. Booking checkout and payments wire in after
          migration <code className="text-xs">0004_aixmos_ecosystem.sql</code> is applied.
        </p>
      </header>

      {migrationNeeded && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-4">
          Catalog tables not found yet — run <code>supabase/migrations/0004_aixmos_ecosystem.sql</code>{" "}
          in the Supabase SQL Editor, then refresh.
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Services</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(services ?? []).map((s) => (
            <Card key={s.slug}>
              <CardHeader>
                <CardTitle>{s.name}</CardTitle>
                <CardDescription>{s.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </CardContent>
            </Card>
          ))}
          {(services ?? []).length === 0 && !migrationNeeded && (
            <p className="text-sm text-muted-foreground">No services published yet.</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Vehicles</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(vehicles ?? []).map((v) => (
            <Card key={v.id}>
              <CardHeader>
                <CardTitle>{v.label}</CardTitle>
                <CardDescription>
                  {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Fleet vehicle"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {v.daily_rate != null && (
                  <p className="text-sm font-medium">${Number(v.daily_rate).toFixed(0)} / day</p>
                )}
              </CardContent>
            </Card>
          ))}
          {(vehicles ?? []).length === 0 && !migrationNeeded && (
            <p className="text-sm text-muted-foreground">No vehicles in fleet yet — add rows in Supabase.</p>
          )}
        </div>
      </section>

      <div className="flex gap-4">
        <Link href="/intake">
          <Button>Request a rental or service</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost">Back home</Button>
        </Link>
      </div>
    </main>
  );
}
