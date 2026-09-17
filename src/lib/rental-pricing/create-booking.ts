import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAvailability, daysBetween, type ExistingBooking, type Interval } from "./availability";
import { quoteVehicle } from "./queries";
import { enforceFloor, readFleetRate, resolveWeeklyCents, type FleetPriceRow } from "./fleet-rate";
import type { QuotableVehicle, RentalQuote } from "./quote";

/**
 * The booking write path: quote -> check -> hold.
 *
 * This is the first code in the repo that writes public.bookings. The table,
 * its RLS and its discount-approval chain have existed since June with nothing
 * connected to them.
 *
 * TWO LAYERS GUARD THE CALENDAR, DELIBERATELY:
 *   1. checkAvailability() here, which gives a useful answer fast.
 *   2. the bookings_no_overlap EXCLUDE constraint in the database, which is the
 *      only thing that can win a race between two simultaneous requests.
 * Layer 1 without layer 2 is a lie under concurrency, so this module treats a
 * SQLSTATE 23P01 from the insert as a normal conflict outcome, not a crash.
 * Until the migration is applied, only layer 1 exists — see BOOKING_GUARD_NOTE.
 *
 * WHERE THIS SITS RELATIVE TO THE OWNER-APPROVAL GATE
 * CLAUDE.md requires every customer-facing, financial, legal or production-bound
 * path to terminate at an owner-approval step. This module stays deliberately on
 * the near side of that line: it writes status 'hold' and nothing else. It sends
 * no message, takes no payment, signs nothing, and releases no car —
 * `insurance_verified` and `lot_release_approved` are both written false and are
 * never set true from here.
 *
 * Confirming a booking, capturing the deposit, or releasing the vehicle from the
 * lot are all separate actions that MUST route through
 * shared/owner-approval-gate/. Do not add them to this file.
 */

export const BOOKING_GUARD_NOTE =
  "Database-level overlap protection requires migration " +
  "20260916235900_bookings_no_double_booking.sql. Until it is applied, two " +
  "simultaneous requests can both pass the application check.";

/** Postgres exclusion_violation — the race-loss signal. */
const PG_EXCLUSION_VIOLATION = "23P01";
/** Postgres unique_violation — a ref_code collision. */
const PG_UNIQUE_VIOLATION = "23505";

export type CreateBookingInput = {
  /** Row from the live `fleet` table — the real inventory. */
  fleetVehicle: FleetPriceRow & { vehicle_status?: string | null };
  /** The normalised `vehicles.id` this booking points at (FK target). */
  vehicleId: string;
  /** Tier must be supplied deliberately; fleet.vehicle_class is unusable. */
  vehicle: QuotableVehicle;
  interval: Interval;
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  /** Only an approved renter may be sold coverage. */
  backgroundApproved: boolean;
  insuranceProductId?: string | null;
  orgId: string;
  /** Pre-fetched bookings for this vehicle. Cheap because of the partial index. */
  existingBookings: readonly ExistingBooking[];
};

export type CreateBookingResult =
  | { ok: true; bookingId: string; refCode: string; quote: RentalQuote; weeklyCents: number }
  | { ok: false; reason: "unavailable"; detail: ReturnType<typeof checkAvailability> }
  | { ok: false; reason: "not_priceable" }
  | { ok: false; reason: "below_floor"; weeklyCents: number; floorWeeklyCents: number }
  | { ok: false; reason: "quote_failed"; detail: string }
  | { ok: false; reason: "conflict_race" }
  | { ok: false; reason: "write_failed"; detail: string };

/**
 * Human-readable, collision-resistant booking reference.
 * Caller supplies randomness so this stays testable and deterministic.
 */
export function makeRefCode(seed: string): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.abs(hash(seed + i)) % alphabet.length];
  }
  return `TMMT-${out}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export async function createBooking(
  supabase: SupabaseClient,
  input: CreateBookingInput,
  opts?: { refSeed?: string }
): Promise<CreateBookingResult> {
  // 1. Is the car free and rentable at all? Cheapest check first.
  const availability = checkAvailability({
    interval: input.interval,
    fleetStatus: input.fleetVehicle.vehicle_status,
    existingBookings: input.existingBookings,
  });
  if (!availability.available) {
    return { ok: false, reason: "unavailable", detail: availability };
  }

  const days = daysBetween(input.interval);

  // 2. Price it. The tier card is only ever a fallback (see fleet-rate.ts).
  let quoteResult;
  try {
    quoteResult = await quoteVehicle(supabase, {
      vehicle: input.vehicle,
      days,
      backgroundApproved: input.backgroundApproved,
      insuranceProductId: input.insuranceProductId,
    });
  } catch (e) {
    return { ok: false, reason: "quote_failed", detail: e instanceof Error ? e.message : String(e) };
  }
  if (!quoteResult.ok) {
    return { ok: false, reason: "quote_failed", detail: quoteResult.reason };
  }

  // 3. The car's OWN posted price beats the tier card.
  const rate = readFleetRate(input.fleetVehicle);
  const resolved = resolveWeeklyCents({
    rate,
    tierCardWeeklyCents: quoteResult.quote.quoted_weekly_cents,
  });
  if (!resolved) return { ok: false, reason: "not_priceable" };

  // 4. THE MONEY GUARD. Never below this car's recorded floor.
  const floor = enforceFloor(resolved.weeklyCents, rate);
  if (!floor.ok) {
    return {
      ok: false,
      reason: "below_floor",
      weeklyCents: floor.weeklyCents,
      floorWeeklyCents: floor.floorWeeklyCents,
    };
  }

  const refCode = makeRefCode(
    opts?.refSeed ?? `${input.vehicleId}|${input.interval.startsAt.toISOString()}|${input.customer.email ?? ""}`
  );

  // 5. Write the hold. Status is 'hold', never 'confirmed': nothing is confirmed
  //    until money is actually taken, and this module does not take money.
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      ref_code: refCode,
      org_id: input.orgId,
      vehicle_id: input.vehicleId,
      status: "hold",
      starts_at: input.interval.startsAt.toISOString(),
      ends_at: input.interval.endsAt.toISOString(),
      customer_name: input.customer.name ?? null,
      customer_email: input.customer.email?.trim().toLowerCase() ?? null,
      customer_phone: input.customer.phone ?? null,
      vehicle_tier: input.vehicle.tier,
      quoted_daily_cents: quoteResult.quote.quoted_daily_cents,
      quoted_weekly_cents: floor.weeklyCents,
      quoted_deposit_cents: quoteResult.quote.quoted_deposit_cents,
      pricing_rule_id: quoteResult.quote.pricing_rule_id,
      insurance_coverage_source: quoteResult.quote.insurance ? "tmmt_internal" : "pending",
      insurance_verified: false,
      lot_release_approved: false,
      metadata: {
        rate_source: resolved.source,
        quote_lines: quoteResult.quote.lines,
        subtotal_cents: quoteResult.quote.subtotal_cents,
        due_now_cents: quoteResult.quote.due_now_cents,
        days,
      },
    })
    .select("id, ref_code")
    .single();

  if (error) {
    // The database refused because another request took the car first. This is
    // an expected outcome under load, not an error condition.
    if (error.code === PG_EXCLUSION_VIOLATION) return { ok: false, reason: "conflict_race" };
    if (error.code === PG_UNIQUE_VIOLATION) return { ok: false, reason: "conflict_race" };
    return { ok: false, reason: "write_failed", detail: error.message };
  }

  return {
    ok: true,
    bookingId: (data as { id: string }).id,
    refCode: (data as { ref_code: string }).ref_code,
    quote: quoteResult.quote,
    weeklyCents: floor.weeklyCents,
  };
}
