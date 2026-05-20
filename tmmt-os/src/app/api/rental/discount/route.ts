import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  evaluateDiscount,
  findAlternativeVehicles,
  type DiscountMode,
} from "@/lib/rental-pricing/evaluate-discount";
import { suggestRentalRateFromFleetRow } from "@/lib/rental-pricing/suggest-rental-rate";

const bodySchema = z.object({
  mode: z.enum(["percent", "fixed_off", "target_weekly"]),
  value: z.number(),
  acquisitionCost: z.number().min(0).optional(),
  listPrice: z.number().min(0).optional(),
  operatorInsuranceMonthly: z.number().min(0).optional(),
  insuranceMarkup: z.number().min(2).max(5).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  tier: z.enum(["economy", "mid", "luxury"]).optional(),
  minMarginPercent: z.number().min(0).max(50).optional(),
  vehicleId: z.string().uuid().optional(),
  findAlternatives: z.boolean().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const suggestion = suggestRentalRateFromFleetRow({
    acquisition_cost: d.acquisitionCost,
    list_price: d.listPrice,
    operator_insurance_monthly: d.operatorInsuranceMonthly,
    insurance_markup_multiplier: d.insuranceMarkup,
    vehicle_make: d.make,
    vehicle_model: d.model,
    year: d.year,
    tier: d.tier,
  });

  const evaluation = evaluateDiscount(
    suggestion,
    { mode: d.mode as DiscountMode, value: d.value },
    { minVehicleMarginPercent: d.minMarginPercent }
  );

  let alternatives: ReturnType<typeof findAlternativeVehicles> = [];
  if (evaluation.shouldReferAlternatives || d.findAlternatives) {
    const targetWeekly =
      d.mode === "target_weekly"
        ? d.value
        : evaluation.discountedWeeklyCents / 100;

    const supabase = createSupabaseServerClient();
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select(
        "id, label, make, model, year, tier, status, acquisition_cost, list_price, operator_insurance_monthly, insurance_markup_multiplier"
      )
      .eq("active", true)
      .limit(80);

    alternatives = findAlternativeVehicles(targetWeekly, vehicles ?? [], {
      excludeVehicleId: d.vehicleId,
      preferTier: d.tier,
      minVehicleMarginPercent: d.minMarginPercent,
    });

    if ((vehicles ?? []).length === 0) {
      const { data: fleetBridge } = await supabase
        .from("vehicles")
        .select("id, label, make, model, year, tier, metadata")
        .eq("active", true)
        .limit(1);
      void fleetBridge;
    }
  }

  return NextResponse.json({
    suggestion: {
      suggestedWeekly: suggestion.suggestedWeeklyLetGoCents / 100,
      minAcceptableWeekly: suggestion.minAcceptableWeeklyCents / 100,
      maxDiscountWeekly: suggestion.maxDiscountWeeklyDollars,
    },
    evaluation: {
      ...evaluation,
      baseWeekly: evaluation.baseWeeklyCents / 100,
      discountedWeekly: evaluation.discountedWeeklyCents / 100,
      minAcceptableWeekly: evaluation.minAcceptableWeeklyCents / 100,
      canApplyWithoutManager:
        evaluation.canCloseOnThisVehicle && !evaluation.requiresManagerApproval,
    },
    alternatives: alternatives.map((a) => ({
      ...a,
      suggestedWeekly: a.suggestedWeeklyCents / 100,
      minAcceptableWeekly: a.minAcceptableWeeklyCents / 100,
      atClientTargetWeekly: a.atClientTargetWeeklyCents / 100,
      headroomDollars: a.headroomCents / 100,
    })),
  });
}
