import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchInsuranceProducts, fetchPricingRules } from "@/lib/rental-pricing/queries";
import { inferVehicleTier, tierLabel } from "@/lib/rental-pricing/infer-tier";
import { resolveRentalQuote } from "@/lib/rental-pricing/resolve-quote";
import type { VehicleTier } from "@/lib/rental-pricing/types";

export const dynamic = "force-dynamic";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

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
        .select("id, label, make, model, year, daily_rate, tier, weekly_rate")
        .eq("active", true)
        .order("label")
        .limit(12),
    ]);

  const migrationNeeded =
    servicesErr?.message.includes("does not exist") ||
    vehiclesErr?.message.includes("does not exist");

  const [pricingRules, insuranceProducts] = migrationNeeded
    ? [[], []]
    : await Promise.all([fetchPricingRules(), fetchInsuranceProducts()]);

  const pricedVehicles = (vehicles ?? []).map((v) => {
    const tier =
      (v.tier as VehicleTier | null) ??
      inferVehicleTier({ make: v.make, model: v.model, year: v.year });
    const quote = resolveRentalQuote(
      {
        make: v.make,
        model: v.model,
        year: v.year,
        tier,
        rentalDays: 7,
        insuranceSource: "tmmt_internal",
      },
      pricingRules,
      insuranceProducts
    );
    return { ...v, tier, quote };
  });

  return (
    <main className="min-h-screen container py-16 space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">TMMT Rentals</p>
        <h1 className="text-4xl font-semibold">Marketplace</h1>
        <p className="text-muted-foreground max-w-2xl">
          Economy, mid-tier, and luxury vehicles priced by make, model, and year. Insurance is
          quoted separately — use your own policy, TMMT internal coverage (after background check),
          or a corporate non-owner policy before pickup.
        </p>
      </header>

      {migrationNeeded && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-4">
          Catalog tables not found yet — run{" "}
          <code>supabase/migrations/0004_aixmos_ecosystem.sql</code> and{" "}
          <code>0017_rental_pricing_insurance.sql</code> in the Supabase SQL Editor, then refresh.
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Fleet tiers</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["economy", "mid", "luxury"] as const).map((tier) => {
            const sample = resolveRentalQuote(
              { tier, rentalDays: 7, insuranceSource: "tmmt_internal" },
              pricingRules,
              insuranceProducts
            );
            return (
              <Card key={tier}>
                <CardHeader>
                  <CardTitle>{tierLabel(tier)}</CardTitle>
                  <CardDescription>From {formatCents(sample.weeklyRateCents)} / week</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>{formatCents(sample.dailyRateCents)} / day</p>
                  <p>Deposit {formatCents(sample.depositCents)}</p>
                  <p>Internal insurance from {formatCents(sample.insuranceWeeklyCents)} / week</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

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
          {pricedVehicles.map((v) => (
            <Card key={v.id}>
              <CardHeader>
                <CardTitle>{v.label}</CardTitle>
                <CardDescription>
                  {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Fleet vehicle"}
                  {" · "}
                  {tierLabel(v.tier)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">
                  {formatCents(v.quote.weeklyRateCents)} / week ·{" "}
                  {formatCents(v.quote.dailyRateCents)} / day
                </p>
                <p className="text-muted-foreground">
                  Deposit {formatCents(v.quote.depositCents)} · Insurance add-on from{" "}
                  {formatCents(v.quote.insuranceWeeklyCents)}/wk
                </p>
              </CardContent>
            </Card>
          ))}
          {pricedVehicles.length === 0 && !migrationNeeded && (
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
