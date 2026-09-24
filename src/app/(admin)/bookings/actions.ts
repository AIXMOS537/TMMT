"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import { checkAvailability, daysBetween, type ExistingBooking } from "@/lib/rental-pricing/availability";
import { createBooking } from "@/lib/rental-pricing/create-booking";
import { enforceFloor, readFleetRate, resolveWeeklyCents } from "@/lib/rental-pricing/fleet-rate";
import { quoteVehicle } from "@/lib/rental-pricing/queries";
import { VEHICLE_TIERS, type VehicleTier } from "@/lib/rental-pricing/quote";

/**
 * The rental board's server side.
 *
 * WHY THIS EXISTS
 * TMMT OS ships 110 routes and, until this one, not a single booking screen —
 * while `bookings`, `rental_pricing_rules` and `rental_insurance_products` sat
 * fully built and seeded in the database with no code attached. The engine
 * (src/lib/rental-pricing/) was wired first; this is the screen that reaches it.
 *
 * OWNER-APPROVAL GATE: this file stays on the near side of it, deliberately.
 * It reads availability, it quotes, and it writes a HOLD. It sends no message,
 * takes no payment, signs nothing and releases no car. Confirming a booking,
 * capturing a deposit and lot release are separate actions that MUST route
 * through shared/owner-approval-gate/ — do not add them here.
 */

export type BoardVehicle = {
  vehicleId: string;
  label: string;
  tier: VehicleTier;
  make: string | null;
  model: string | null;
  year: number | null;
  fleetStatus: string | null;
  postedWeekly: string | null;
  floorWeekly: string | null;
  /** Why this car cannot be booked for the asked window, or null when it can. */
  blocked:
    | null
    | { reason: "vehicle_not_bookable"; fleetStatus: string | null }
    | { reason: "conflict"; conflictingBookingIds: string[] }
    | { reason: "invalid_interval" };
  /** Populated only when the car is free AND priceable. */
  quote:
    | null
    | {
        weeklyCents: number;
        depositCents: number;
        subtotalCents: number;
        dueNowCents: number;
        rateSource: "fleet_posted" | "tier_card";
        days: number;
      };
  /** Present when the car is free but could not be priced honestly. */
  priceProblem: string | null;
};

function isTier(v: unknown): v is VehicleTier {
  return typeof v === "string" && (VEHICLE_TIERS as readonly string[]).includes(v);
}

/**
 * One board read: every vehicle, its availability for the window, and its price.
 *
 * Deliberately returns a row for EVERY vehicle, including the blocked ones,
 * with the reason attached. A board that silently drops unavailable cars tells
 * the operator nothing about why the lot looks empty.
 */
export async function loadBoard(startsAtISO: string, endsAtISO: string) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in first." };
  if (!isStaffUser(user)) return { ok: false as const, error: "Staff only." };

  const startsAt = new Date(startsAtISO);
  const endsAt = new Date(endsAtISO);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return { ok: false as const, error: "Pick an end date after the start date." };
  }

  // `vehicles` is the FK target for bookings; `fleet` carries the live status
  // and the car's own posted price. Both are needed to answer "can I rent this".
  const { data: vehicleRows, error: vErr } = await supabase
    .from("vehicles")
    .select("id, label, make, model, year, tier, active, fleet_vehicle_id")
    .eq("active", true);
  if (vErr) return { ok: false as const, error: `Could not read vehicles: ${vErr.message}` };

  const fleetIds = (vehicleRows ?? [])
    .map((v) => v.fleet_vehicle_id)
    .filter((x): x is string => typeof x === "string");

  const { data: fleetRows } = fleetIds.length
    ? await supabase
        .from("fleet")
        .select("id, vehicle_status, weekly_prices, lowest_possible_price")
        .in("id", fleetIds)
    : { data: [] as Array<Record<string, unknown>> };

  const fleetById = new Map<string, Record<string, unknown>>();
  for (const f of fleetRows ?? []) fleetById.set(String(f.id), f);

  // Every live booking touching the window, one read, not one per vehicle.
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("id, vehicle_id, status, starts_at, ends_at")
    .in("status", ["hold", "confirmed", "active"]);

  const bookingsByVehicle = new Map<string, ExistingBooking[]>();
  for (const b of (bookingRows ?? []) as ExistingBooking[]) {
    if (!b.vehicle_id) continue;
    const list = bookingsByVehicle.get(b.vehicle_id) ?? [];
    list.push(b);
    bookingsByVehicle.set(b.vehicle_id, list);
  }

  const days = daysBetween({ startsAt, endsAt });
  const out: BoardVehicle[] = [];

  for (const v of vehicleRows ?? []) {
    const tier = isTier(v.tier) ? v.tier : null;
    const fleet = v.fleet_vehicle_id ? fleetById.get(String(v.fleet_vehicle_id)) : undefined;
    const fleetStatus = (fleet?.vehicle_status as string | null) ?? null;
    const weeklyPrices = fleet?.weekly_prices;
    const postedWeekly = Array.isArray(weeklyPrices) && weeklyPrices.length > 0 ? String(weeklyPrices[0]) : null;
    const floorWeekly = fleet?.lowest_possible_price != null ? String(fleet.lowest_possible_price) : null;

    const availability = checkAvailability({
      interval: { startsAt, endsAt },
      fleetStatus,
      existingBookings: bookingsByVehicle.get(String(v.id)) ?? [],
    });

    const base: BoardVehicle = {
      vehicleId: String(v.id),
      label: (v.label as string) ?? "Unnamed vehicle",
      tier: tier ?? "economy",
      make: (v.make as string) ?? null,
      model: (v.model as string) ?? null,
      year: typeof v.year === "number" ? v.year : null,
      fleetStatus,
      postedWeekly,
      floorWeekly,
      blocked: null, // set precisely below when the car is not free
      quote: null,
      priceProblem: null,
    };

    if (!availability.available) {
      base.blocked =
        availability.reason === "conflict"
          ? { reason: "conflict", conflictingBookingIds: availability.conflictingBookingIds }
          : availability.reason === "vehicle_not_bookable"
            ? { reason: "vehicle_not_bookable", fleetStatus: availability.fleetStatus }
            : { reason: "invalid_interval" };
      out.push(base);
      continue;
    }

    if (!tier) {
      base.priceProblem = "No tier set on this vehicle — cannot match a rate.";
      out.push(base);
      continue;
    }

    const quoted = await quoteVehicle(supabase, {
      vehicle: { tier, make: base.make, model: base.model, year: base.year },
      days,
      backgroundApproved: false, // coverage is chosen later, per renter
    });

    if (!quoted.ok) {
      base.priceProblem = quoted.reason;
      out.push(base);
      continue;
    }

    const rate = readFleetRate({ weekly_prices: postedWeekly ? [postedWeekly] : null, lowest_possible_price: floorWeekly });
    const resolved = resolveWeeklyCents({ rate, tierCardWeeklyCents: quoted.quote.quoted_weekly_cents });
    if (!resolved) {
      base.priceProblem = "not_priceable";
      out.push(base);
      continue;
    }

    const floor = enforceFloor(resolved.weeklyCents, rate);
    if (!floor.ok) {
      base.priceProblem = `below_floor: ${floor.weeklyCents} under floor ${floor.floorWeeklyCents}`;
      out.push(base);
      continue;
    }

    const weeks = Math.floor(days / 7);
    const extra = days % 7;
    const dailyCents = Math.round(floor.weeklyCents / 7);
    const rent = weeks * floor.weeklyCents + Math.min(extra * dailyCents, floor.weeklyCents);

    base.quote = {
      weeklyCents: floor.weeklyCents,
      depositCents: quoted.quote.quoted_deposit_cents,
      subtotalCents: rent,
      dueNowCents: rent + quoted.quote.quoted_deposit_cents,
      rateSource: resolved.source,
      days,
    };
    out.push(base);
  }

  out.sort((a, b) => Number(Boolean(a.blocked)) - Number(Boolean(b.blocked)) || a.label.localeCompare(b.label));
  return { ok: true as const, vehicles: out, days };
}

export type HoldResult =
  | { ok: true; refCode: string; bookingId: string }
  | { ok: false; error: string };

/**
 * Place a HOLD. Never a confirmation — no money changes hands here.
 */
export async function placeHold(input: {
  vehicleId: string;
  startsAtISO: string;
  endsAtISO: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}): Promise<HoldResult> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!isStaffUser(user)) return { ok: false, error: "Staff only." };

  if (!input.customerName?.trim()) return { ok: false, error: "Renter name is required." };
  if (!input.customerEmail?.trim()) return { ok: false, error: "Renter email is required." };

  const startsAt = new Date(input.startsAtISO);
  const endsAt = new Date(input.endsAtISO);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return { ok: false, error: "Pick an end date after the start date." };
  }

  const { data: v, error: vErr } = await supabase
    .from("vehicles")
    .select("id, tier, make, model, year, org_id, fleet_vehicle_id")
    .eq("id", input.vehicleId)
    .maybeSingle();
  if (vErr || !v) return { ok: false, error: "That vehicle is no longer on the board." };
  if (!isTier(v.tier)) return { ok: false, error: "This vehicle has no tier set, so it cannot be priced." };
  if (!v.org_id) return { ok: false, error: "This vehicle has no organisation and cannot be booked." };

  const { data: fleet } = v.fleet_vehicle_id
    ? await supabase
        .from("fleet")
        .select("vehicle_status, weekly_prices, lowest_possible_price")
        .eq("id", v.fleet_vehicle_id)
        .maybeSingle()
    : { data: null };

  const { data: existing } = await supabase
    .from("bookings")
    .select("id, vehicle_id, status, starts_at, ends_at")
    .eq("vehicle_id", input.vehicleId)
    .in("status", ["hold", "confirmed", "active"]);

  const result = await createBooking(supabase, {
    fleetVehicle: {
      weekly_prices: fleet?.weekly_prices ?? null,
      lowest_possible_price: fleet?.lowest_possible_price ?? null,
      vehicle_status: (fleet?.vehicle_status as string | null) ?? null,
    },
    vehicleId: String(v.id),
    vehicle: {
      tier: v.tier,
      make: (v.make as string) ?? null,
      model: (v.model as string) ?? null,
      year: typeof v.year === "number" ? v.year : null,
    },
    interval: { startsAt, endsAt },
    customer: {
      name: input.customerName.trim(),
      email: input.customerEmail.trim(),
      phone: input.customerPhone?.trim() || null,
    },
    backgroundApproved: false,
    orgId: String(v.org_id),
    existingBookings: (existing ?? []) as ExistingBooking[],
  });

  if (result.ok) return { ok: true, refCode: result.refCode, bookingId: result.bookingId };
  // The database refused the dates: its message is already written for a human.
  if (
    result.reason === "conflict_race" ||
    result.reason === "rejected_dates" ||
    result.reason === "wrong_org"
  ) {
    return { ok: false, error: result.message };
  }

  // Every refusal is deliberate. Say which one, in words an operator can act on.
  const messages: Record<string, string> = {
    unavailable: "That car is not free for those dates.",
    not_priceable: "That car has no posted price and no usable rate — price it before booking.",
    below_floor: "Refused: the rate works out below this car's own floor price.",
    quote_failed: "Could not price this booking.",
    write_failed: "The booking could not be saved.",
  };
  return { ok: false, error: messages[result.reason] ?? "The booking was refused." };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Putting a car ON the board.
 *
 * `bookings.vehicle_id` is a foreign key to `vehicles`, which holds 2 rows,
 * while `fleet` — the real inventory — holds 43. So 41 cars cannot be booked at
 * all. A bridge script ran once on 2026-06-26, did two cars and stopped.
 *
 * The blocker was never technical: `vehicles.tier` decides which rate card row
 * a car can match and which coverage it is sold, so it is a PRICING decision.
 * `fleet.vehicle_class` cannot supply it — 3 of 43 rows are populated and all
 * three are wrong in production (a Tesla Model 3 filed as "sport_bike").
 *
 * So rather than a migration that guesses tiers on the owner's behalf, this is
 * the decision made where it belongs: an operator picks the tier, sees the rate
 * that will result, and puts the car on the board.
 * ──────────────────────────────────────────────────────────────────────────── */

export type FleetCandidate = {
  fleetId: string;
  label: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicleStatus: string | null;
  postedWeekly: string | null;
  floorWeekly: string | null;
};

/** Fleet cars that are not yet on the board. Retired cars are never offered. */
export async function listFleetCandidates() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in first." };
  if (!isStaffUser(user)) return { ok: false as const, error: "Staff only." };

  const { data: bridged } = await supabase.from("vehicles").select("fleet_vehicle_id");
  const taken = new Set(
    (bridged ?? []).map((r) => r.fleet_vehicle_id).filter((x): x is string => typeof x === "string")
  );

  const { data: fleet, error } = await supabase
    .from("fleet")
    .select("id, vehicle_name, vehicle_make, vehicle_model, year, vehicle_status, weekly_prices, lowest_possible_price");
  if (error) return { ok: false as const, error: `Could not read the fleet: ${error.message}` };

  const out: FleetCandidate[] = [];
  for (const f of fleet ?? []) {
    const id = String(f.id);
    if (taken.has(id)) continue;
    if ((f.vehicle_status as string | null) === "Retired") continue;
    if (!f.vehicle_make) continue;

    const yearRaw = f.year;
    const yearNum =
      typeof yearRaw === "number" ? yearRaw : typeof yearRaw === "string" ? Number(yearRaw.replace(/\D/g, "")) : NaN;
    const weekly = Array.isArray(f.weekly_prices) && f.weekly_prices.length > 0 ? String(f.weekly_prices[0]) : null;

    out.push({
      fleetId: id,
      label:
        (f.vehicle_name as string) ||
        `${Number.isFinite(yearNum) ? `${yearNum} ` : ""}${String(f.vehicle_make).trim()} ${String(f.vehicle_model ?? "").trim()}`.trim(),
      make: String(f.vehicle_make).trim(),
      model: f.vehicle_model ? String(f.vehicle_model).trim() : null,
      year: Number.isFinite(yearNum) ? yearNum : null,
      vehicleStatus: (f.vehicle_status as string | null) ?? null,
      postedWeekly: weekly,
      floorWeekly: f.lowest_possible_price != null ? String(f.lowest_possible_price) : null,
    });
  }

  out.sort((a, b) => a.label.localeCompare(b.label));
  return { ok: true as const, candidates: out };
}

/**
 * Put one fleet car on the board at a stated tier.
 *
 * Refuses a car with no posted weekly price. Such a car would fall through to
 * the tier rate card, and that card prices a luxury business ($1,550/wk for a
 * 7 Series) against a $300-550/wk gig fleet — five of its seven make/model rules
 * match no vehicle at all. Guessing a rate is exactly the money bug the floor
 * guard exists to prevent, so the answer is "price it first", not a default.
 *
 * daily_rate = weekly / 7, matching the convention of the two rows the original
 * 2026-06-26 bridge left behind.
 */
export async function addVehicleToBoard(input: { fleetId: string; tier: string }) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in first." };
  if (!isStaffUser(user)) return { ok: false as const, error: "Staff only." };
  if (!isTier(input.tier)) return { ok: false as const, error: "Pick a tier: economy, mid or luxury." };

  const { data: f, error: fErr } = await supabase
    .from("fleet")
    .select("id, vehicle_name, vehicle_make, vehicle_model, year, vin, license_plate, vehicle_status, weekly_prices, lowest_possible_price, org_id")
    .eq("id", input.fleetId)
    .maybeSingle();
  if (fErr || !f) return { ok: false as const, error: "That car is not in the fleet." };
  if (!f.org_id) return { ok: false as const, error: "That car has no organisation set." };

  const { data: already } = await supabase
    .from("vehicles")
    .select("id")
    .eq("fleet_vehicle_id", input.fleetId)
    .maybeSingle();
  if (already) return { ok: false as const, error: "That car is already on the board." };

  const weeklyRaw = Array.isArray(f.weekly_prices) && f.weekly_prices.length > 0 ? String(f.weekly_prices[0]) : "";
  const weekly = Number(weeklyRaw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(weekly) || weekly <= 0) {
    return {
      ok: false as const,
      error: "This car has no posted weekly price. Set its price on the fleet record first — the rate card would misprice it.",
    };
  }

  const yearRaw = f.year;
  const yearNum =
    typeof yearRaw === "number" ? yearRaw : typeof yearRaw === "string" ? Number(yearRaw.replace(/\D/g, "")) : NaN;

  const label =
    (f.vehicle_name as string) ||
    `${Number.isFinite(yearNum) ? `${yearNum} ` : ""}${String(f.vehicle_make ?? "").trim()} ${String(f.vehicle_model ?? "").trim()}`.trim();

  const { error: insErr } = await supabase.from("vehicles").insert({
    label,
    make: f.vehicle_make ? String(f.vehicle_make).trim() : null,
    model: f.vehicle_model ? String(f.vehicle_model).trim() : null,
    year: Number.isFinite(yearNum) ? yearNum : null,
    vin: f.vin ?? null,
    plate: f.license_plate ?? null,
    weekly_rate: weekly,
    daily_rate: Math.round((weekly / 7) * 100) / 100,
    tier: input.tier,
    active: (f.vehicle_status as string | null) !== "Retired",
    fleet_vehicle_id: input.fleetId,
    org_id: f.org_id,
    metadata: {
      source: "board_add",
      added_by: user.id,
      posted_weekly_at_add: weeklyRaw,
      floor_weekly_at_add: f.lowest_possible_price ?? null,
    },
  });
  if (insErr) return { ok: false as const, error: `Could not add the car: ${insErr.message}` };

  return { ok: true as const, label, weekly };
}
