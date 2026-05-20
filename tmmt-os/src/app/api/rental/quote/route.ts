import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchInsuranceProducts, fetchPricingRules } from "@/lib/rental-pricing/queries";
import { resolveRentalQuote } from "@/lib/rental-pricing/resolve-quote";
import { dollarsToCents } from "@/lib/rental-pricing/suggest-rental-rate";
import type { InsuranceCoverageSource, VehicleTier } from "@/lib/rental-pricing/types";

const quoteSchema = z.object({
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.coerce.number().int().min(1980).max(2035).optional(),
  tier: z.enum(["economy", "mid", "luxury"]).optional(),
  rentalDays: z.coerce.number().int().min(1).max(365).optional(),
  insuranceSource: z
    .enum(["renter_own", "tmmt_internal", "corporate_non_owner", "pending"])
    .optional(),
  backgroundCheckStatus: z.string().max(50).optional(),
  riskScore: z.coerce.number().int().min(0).max(100).optional(),
  policyNumber: z.string().max(100).optional(),
  carrierName: z.string().max(200).optional(),
  corporatePolicyId: z.string().max(100).optional(),
  verifiedAt: z.string().optional(),
  acquisitionCost: z.coerce.number().min(0).optional(),
  listPrice: z.coerce.number().min(0).optional(),
  operatorInsuranceMonthly: z.coerce.number().min(0).optional(),
  insuranceMarkup: z.coerce.number().min(2).max(5).optional(),
  useCostBasis: z.coerce.boolean().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = quoteSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const [pricingRules, insuranceProducts] = await Promise.all([
    fetchPricingRules(),
    fetchInsuranceProducts(),
  ]);

  const quote = resolveRentalQuote(
    {
      make: d.make,
      model: d.model,
      year: d.year,
      tier: d.tier as VehicleTier | undefined,
      rentalDays: d.rentalDays ?? 7,
      insuranceSource: (d.insuranceSource ?? "pending") as InsuranceCoverageSource,
      backgroundCheckStatus: d.backgroundCheckStatus,
      riskScore: d.riskScore,
      acquisitionCostCents:
        d.acquisitionCost != null ? dollarsToCents(d.acquisitionCost) : undefined,
      listPriceCents: d.listPrice != null ? dollarsToCents(d.listPrice) : undefined,
      operatorInsuranceMonthlyCents:
        d.operatorInsuranceMonthly != null
          ? dollarsToCents(d.operatorInsuranceMonthly)
          : undefined,
      insuranceMarkupMultiplier: d.insuranceMarkup,
      useCostBasis: d.useCostBasis,
    },
    pricingRules,
    insuranceProducts
  );

  if (d.insuranceSource === "renter_own" || d.policyNumber || d.carrierName) {
    const { resolveInsuranceForQuote } = await import("@/lib/rental-insurance/resolve");
    const insurance = resolveInsuranceForQuote({
      tier: quote.tier,
      requestedSource: (d.insuranceSource ?? "renter_own") as InsuranceCoverageSource,
      backgroundCheckStatus: d.backgroundCheckStatus,
      riskScore: d.riskScore,
      policyNumber: d.policyNumber,
      carrierName: d.carrierName,
      corporatePolicyId: d.corporatePolicyId,
      verifiedAt: d.verifiedAt,
      products: insuranceProducts,
    });
    quote.insuranceSource = insurance.source;
    quote.insuranceWeeklyCents = insurance.weeklyPremiumCents;
    quote.insuranceProductName = insurance.productName;
    quote.lotReleaseEligible = insurance.lotReleaseEligible;
    quote.lotReleaseBlockers = insurance.blockers;
  }

  return NextResponse.json({ quote });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const params = new URLSearchParams(
    Object.entries(parsed.data).map(([k, v]) => [k, String(v)])
  );
  return GET(new Request(`http://local/api/rental/quote?${params}`));
}
