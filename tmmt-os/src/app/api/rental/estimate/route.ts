import { NextResponse } from "next/server";
import { z } from "zod";
import {
  dollarsToCents,
  estimateVehicleValueCents,
  resolveVehicleValueCents,
  suggestRentalRate,
} from "@/lib/rental-pricing/suggest-rental-rate";
import type { VehicleTier } from "@/lib/rental-pricing/types";

const estimateSchema = z.object({
  vehicleValue: z.coerce.number().min(0).optional(),
  acquisitionCost: z.coerce.number().min(0).optional(),
  listPrice: z.coerce.number().min(0).optional(),
  operatorInsuranceMonthly: z.coerce.number().min(0).optional(),
  insuranceMarkup: z.coerce.number().min(2).max(5).optional(),
  profitMarginPercent: z.coerce.number().min(0).max(100).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.coerce.number().int().min(1980).max(2035).optional(),
  tier: z.enum(["economy", "mid", "luxury"]).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = estimateSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid estimate parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const resolved = resolveVehicleValueCents({
    acquisitionCostCents: d.acquisitionCost != null ? dollarsToCents(d.acquisitionCost) : null,
    listPriceCents: d.listPrice != null ? dollarsToCents(d.listPrice) : null,
    make: d.make,
    model: d.model,
    year: d.year,
    tier: d.tier as VehicleTier | undefined,
  });

  const vehicleValueCents =
    d.vehicleValue != null && d.vehicleValue > 0
      ? dollarsToCents(d.vehicleValue)
      : resolved.cents;

  const operatorInsuranceMonthlyCents =
    d.operatorInsuranceMonthly != null ? dollarsToCents(d.operatorInsuranceMonthly) : 0;

  const suggestion = suggestRentalRate({
    vehicleValueCents,
    operatorInsuranceMonthlyCents,
    insuranceMarkupMultiplier: d.insuranceMarkup,
    profitMarginPercent: d.profitMarginPercent,
    tier: d.tier as VehicleTier | undefined,
    make: d.make,
    model: d.model,
    year: d.year,
  });

  if (d.vehicleValue == null) {
    suggestion.vehicleValueSource = resolved.source === "estimated" ? "estimated" : "provided";
    suggestion.breakdown[0] =
      resolved.source === "estimated"
        ? suggestion.breakdown[0]
        : `Vehicle value (${resolved.source}): $${(vehicleValueCents / 100).toLocaleString()} (${suggestion.tier})`;
  }

  return NextResponse.json({
    suggestion,
    vehicleValueResolvedFrom: resolved.source,
  });
}
