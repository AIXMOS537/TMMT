import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import { quoteVehicle } from "@/lib/rental-pricing/queries";
import { VEHICLE_TIERS, type VehicleTier } from "@/lib/rental-pricing/quote";
import { enforceFloor, readFleetRate, resolveWeeklyCents } from "@/lib/rental-pricing/fleet-rate";

/**
 * Staff-only rental quote. READ ONLY.
 *
 * WHY THIS ROUTE EXISTS
 * `src/lib/rental-pricing/` was a library nothing called — which is precisely
 * the failure mode documented in
 * docs/commercialization/COMPETITIVE_TEARDOWN_2026-09-16.md, where a complete
 * rental engine sat in the database for three months with no code attached.
 * A module with no caller is not shipped. This is its caller.
 *
 * OWNER-APPROVAL GATE: NOT REQUIRED, AND DELIBERATELY SO.
 * CLAUDE.md requires every customer-facing, financial, legal or production-bound
 * path to terminate at an owner-approval step. This route does none of those:
 * it sends no message, charges nothing, signs nothing, and writes no row. It
 * answers "what would this cost" for a signed-in staff member. The moment a
 * caller wants to TAKE the money or CONFIRM the booking, that is a different
 * path and it must route through shared/owner-approval-gate/.
 */

type QuoteBody = {
  tier?: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  days?: number;
  backgroundApproved?: boolean;
  insuranceProductId?: string | null;
  /** Optional: the car's own posted price + floor, straight off the fleet row. */
  postedWeeklyPrice?: string | number | null;
  lowestPossiblePrice?: string | number | null;
};

function isTier(v: unknown): v is VehicleTier {
  return typeof v === "string" && (VEHICLE_TIERS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Quotes expose the rate card and the floor. Both are commercially sensitive
  // and neither belongs to an anonymous caller, even though RLS would allow
  // anon to browse active rules.
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, error: "Staff only." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as QuoteBody | null;
  if (!body || !isTier(body.tier)) {
    return NextResponse.json(
      { ok: false, error: `tier is required and must be one of: ${VEHICLE_TIERS.join(", ")}` },
      { status: 400 }
    );
  }

  const days = Number(body.days);
  if (!Number.isFinite(days) || days < 1) {
    return NextResponse.json({ ok: false, error: "days must be a positive number." }, { status: 400 });
  }

  const result = await quoteVehicle(supabase, {
    vehicle: { tier: body.tier, make: body.make, model: body.model, year: body.year },
    days,
    backgroundApproved: body.backgroundApproved === true,
    insuranceProductId: body.insuranceProductId ?? null,
  });

  if (!result.ok) {
    // 422, not 500: the engine refused on purpose. Never fall back to a price.
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 422 });
  }

  // The car's own posted price beats the tier card, and the floor is absolute.
  const rate = readFleetRate({
    weekly_prices: body.postedWeeklyPrice == null ? null : [body.postedWeeklyPrice],
    lowest_possible_price: body.lowestPossiblePrice ?? null,
  });
  const resolved = resolveWeeklyCents({
    rate,
    tierCardWeeklyCents: result.quote.quoted_weekly_cents,
  });
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_priceable" }, { status: 422 });
  }

  const floor = enforceFloor(resolved.weeklyCents, rate);
  if (!floor.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: "below_floor",
        weeklyCents: floor.weeklyCents,
        floorWeeklyCents: floor.floorWeeklyCents,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ok: true,
    quote: { ...result.quote, quoted_weekly_cents: floor.weeklyCents },
    rateSource: resolved.source,
    insuranceOptions: result.insuranceOptions.map((p) => ({
      id: p.id,
      name: p.name,
      coverage_source: p.coverage_source,
      weekly_premium_cents: p.weekly_premium_cents,
    })),
  });
}
