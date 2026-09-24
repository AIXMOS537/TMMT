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
 * Since migration 20260924180000 a 23P01 can also come from the occupancy
 * ledger (vehicle_occupancy_no_block_overlap): the car is blocked for
 * maintenance / out of service / owner hold / damage over those dates.
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
  "Database-level overlap protection is bookings_no_overlap (live in production, " +
  "applied from 20260916235900_bookings_no_double_booking.sql under ledger version " +
  "20260917200051). Block-vs-booking protection needs migration " +
  "20260924180000_vehicle_blocks_and_booking_occupancy.sql, which is NOT applied yet.";

/** What the renter / operator is told when the database refuses the dates. */
export const BOOKING_CONFLICT_MESSAGE = "That car is already booked for those dates.";
export const BOOKING_BLOCKED_MESSAGE =
  "That car is unavailable for those dates (maintenance or out of service).";
export const BOOKING_REJECTED_DATES_MESSAGE =
  "Those dates can't be booked for this car. Check the dates and try again.";
export const BOOKING_WRONG_ORG_MESSAGE =
  "That car belongs to a different organisation and can't be booked here.";

/** Postgres exclusion_violation — the race-loss signal. */
const PG_EXCLUSION_VIOLATION = "23P01";
/** Postgres unique_violation — on bookings this can only be bookings_ref_code_key. */
const PG_UNIQUE_VIOLATION = "23505";
/** How many distinct ref_codes one createBooking call tries before giving up. */
export const REF_CODE_ATTEMPTS = 3;
/** Postgres check_violation — bookings_interval_sane / bookings_status_check. */
const PG_CHECK_VIOLATION = "23514";
/** The occupancy-ledger constraint: a vehicle_block covers these dates. */
const BLOCK_OVERLAP_CONSTRAINT = "vehicle_occupancy_no_block_overlap";
/** Message prefix raised by public.enforce_vehicle_org() (23514): tenant mismatch. */
const VEHICLE_ORG_MISMATCH = "vehicle_org_mismatch";

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
  | { ok: false; reason: "conflict_race"; message: string }
  | { ok: false; reason: "rejected_dates"; message: string }
  | { ok: false; reason: "wrong_org"; message: string }
  | { ok: false; reason: "write_failed"; detail: string };

/**
 * Human-readable booking reference, derived from a seed.
 * Deterministic for a given seed. createBooking() puts a random nonce in the
 * seed, so two attempts at the same car + start + email get DIFFERENT refs
 * (QA B1: an expired hold kept its ref, and re-holding the same car/start/email
 * hit bookings_ref_code_key and was wrongly reported as "already booked").
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

/** Short random nonce for the ref seed. Not a secret; only has to differ between attempts. */
function refNonce(): string {
  return globalThis.crypto.randomUUID().slice(0, 8);
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

  // A fixed refSeed (tests) stays deterministic; otherwise every call gets a fresh nonce.
  // Each retry after a ref_code collision appends the attempt number, so no two
  // attempts ever reuse a ref.
  const seedBase =
    opts?.refSeed ??
    `${input.vehicleId}|${input.interval.startsAt.toISOString()}|${input.customer.email ?? ""}|${refNonce()}`;

  // 5. Write the hold. Status is 'hold', never 'confirmed': nothing is confirmed
  //    until money is actually taken, and this module does not take money.
  let lastRefError = "";
  for (let attempt = 0; attempt < REF_CODE_ATTEMPTS; attempt++) {
    const refCode = makeRefCode(attempt === 0 ? seedBase : `${seedBase}|retry${attempt}`);
    const written = await insertHold(supabase, input, refCode, {
      quote: quoteResult.quote,
      weeklyCents: floor.weeklyCents,
      rateSource: resolved.source,
      days,
    });
    if (written.ok) return written;
    if (written.refCollision) {
      lastRefError = written.detail;
      continue; // a fresh ref, never "already booked": 23505 here says nothing about the car
    }
    return written.result;
  }
  return { ok: false, reason: "write_failed", detail: `ref_code collided ${REF_CODE_ATTEMPTS} times: ${lastRefError}` };
}

type InsertOutcome =
  | (Extract<CreateBookingResult, { ok: true }> & { refCollision?: never })
  | { ok: false; refCollision: true; detail: string }
  | { ok: false; refCollision: false; result: CreateBookingResult };

async function insertHold(
  supabase: SupabaseClient,
  input: CreateBookingInput,
  refCode: string,
  priced: { quote: RentalQuote; weeklyCents: number; rateSource: string; days: number },
): Promise<InsertOutcome> {
  const { quote, weeklyCents, rateSource, days } = priced;
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
      quoted_daily_cents: quote.quoted_daily_cents,
      quoted_weekly_cents: weeklyCents,
      quoted_deposit_cents: quote.quoted_deposit_cents,
      pricing_rule_id: quote.pricing_rule_id,
      insurance_coverage_source: quote.insurance ? "tmmt_internal" : "pending",
      insurance_verified: false,
      lot_release_approved: false,
      metadata: {
        rate_source: rateSource,
        quote_lines: quote.lines,
        subtotal_cents: quote.subtotal_cents,
        due_now_cents: quote.due_now_cents,
        days,
      },
    })
    .select("id, ref_code")
    .single();

  if (error) {
    // A ref_code collision says nothing about the car: the caller retries with a new ref.
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { ok: false, refCollision: true, detail: error.message };
    }
    // The database refused because another request took the car first. This is
    // an expected outcome under load, not an error condition.
    const conflict = mapBookingWriteError(error);
    if (conflict) return { ok: false, refCollision: false, result: conflict };
    return { ok: false, refCollision: false, result: { ok: false, reason: "write_failed", detail: error.message } };
  }

  return {
    ok: true,
    bookingId: (data as { id: string }).id,
    refCode: (data as { ref_code: string }).ref_code,
    quote,
    weeklyCents,
  };
}

/**
 * Turn a database refusal into a user-facing conflict, or null if it is not one.
 *
 * 23P01 means the dates are taken: another booking (bookings_no_overlap) or a
 * vehicle block (vehicle_occupancy_no_block_overlap) holds the car.
 * 23505 (bookings_ref_code_key) is NOT a conflict: refs are random per attempt,
 * so a collision says nothing about the car. createBooking retries it with a new
 * ref, and this function returns null for it.
 * 23514 is either a CHECK failure (bookings_interval_sane / bookings_status_check)
 * or the tenant-integrity trigger (public.enforce_vehicle_org, message prefix
 * "vehicle_org_mismatch"). Neither means "already booked", so each gets its own
 * honest message rather than the conflict one.
 */
export function mapBookingWriteError(error: {
  code?: string | null;
  message?: string | null;
}): Extract<CreateBookingResult, { reason: "conflict_race" | "rejected_dates" | "wrong_org" }> | null {
  switch (error.code) {
    case PG_EXCLUSION_VIOLATION:
      return {
        ok: false,
        reason: "conflict_race",
        message: (error.message ?? "").includes(BLOCK_OVERLAP_CONSTRAINT)
          ? BOOKING_BLOCKED_MESSAGE
          : BOOKING_CONFLICT_MESSAGE,
      };
    case PG_CHECK_VIOLATION:
      if ((error.message ?? "").includes(VEHICLE_ORG_MISMATCH)) {
        return { ok: false, reason: "wrong_org", message: BOOKING_WRONG_ORG_MESSAGE };
      }
      return { ok: false, reason: "rejected_dates", message: BOOKING_REJECTED_DATES_MESSAGE };
    default:
      return null;
  }
}
