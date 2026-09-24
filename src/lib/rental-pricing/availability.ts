/**
 * Availability and double-booking prevention.
 *
 * WHY THIS EXISTS (2026-09-16)
 * Verified against production: `public.bookings` has a PK, several FKs and a
 * unique `ref_code` — and NOTHING that stops two renters holding the same car
 * over the same dates. There is no exclusion constraint and no application
 * code, because nothing writes the table at all yet.
 *
 * "You cannot rent a car that is already out" is the one guarantee every rental
 * product in the teardown gets right. This module is that guarantee in code;
 * the companion migration adds it in the database so a bug here cannot cost a
 * car. Both layers, because an app-level check alone loses the race between two
 * simultaneous requests.
 *
 * INTERVALS ARE HALF-OPEN: [starts_at, ends_at).
 * A booking that ends at 10:00 and one that starts at 10:00 do NOT conflict.
 * Same-day turnaround is normal in rental and must not be blocked.
 */

/**
 * Booking statuses, spelled exactly as the write path stores them.
 * `bookings.status` is free text in the database today — there is no CHECK
 * constraint — so this list is the only vocabulary until the migration lands.
 */
export const BOOKING_STATUSES = [
  "hold",       // quoted and reserved, not yet paid
  "confirmed",  // paid / deposit taken, car is committed
  "active",     // renter has the car
  "completed",  // car returned
  "cancelled",  // never happened
  "no_show",    // renter never collected
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Statuses that actually hold a car off the market.
 * `completed`, `cancelled` and `no_show` release it — that is the whole point
 * of separating them.
 */
export const BLOCKING_STATUSES: readonly BookingStatus[] = ["hold", "confirmed", "active"];

/**
 * How long an unpaid 'hold' keeps a car off the market before it is released.
 *
 * BUSINESS POLICY REQUIRED: 30 is a placeholder until the owner sets the real TTL.
 * The database enforces this, not the app: public.expire_stale_booking_holds()
 * (migration 20260924180000_vehicle_blocks_and_booking_occupancy.sql) moves holds
 * older than this to 'cancelled' every 5 minutes via pg_cron. Its default
 * interval MUST equal this number; the schema-contract test pins the two together.
 */
export const HOLD_TTL_MINUTES = 30;

export function isBookingStatus(v: unknown): v is BookingStatus {
  return typeof v === "string" && (BOOKING_STATUSES as readonly string[]).includes(v);
}

export function blocksAvailability(status: string): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(status);
}

export type Interval = { startsAt: Date; endsAt: Date };

export type ExistingBooking = {
  id: string;
  vehicle_id: string | null;
  status: string;
  starts_at: string | Date;
  ends_at: string | Date;
};

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Half-open overlap: a.start < b.end && b.start < a.end. */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

/**
 * `fleet.vehicle_status` values seen in production 2026-09-16:
 *   Available · Rented · Under Maintenance · Coming Soon · Retired · (null)
 *
 * Only "Available" may be booked. Everything else — including null — is
 * refused. An unknown status is not an available car.
 */
export const BOOKABLE_FLEET_STATUS = "available";

export function fleetStatusAllowsBooking(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === BOOKABLE_FLEET_STATUS;
}

export type AvailabilityVerdict =
  | { available: true }
  | { available: false; reason: "invalid_interval" }
  | { available: false; reason: "vehicle_not_bookable"; fleetStatus: string | null }
  | { available: false; reason: "conflict"; conflictingBookingIds: string[] };

/**
 * The check. Fails closed on every branch.
 *
 * Deliberately takes the candidate interval, the vehicle's current fleet
 * status, and the existing bookings for THAT vehicle. It does no I/O, so it is
 * exhaustively testable and callable from a server action, a route, or a
 * background job without a database double.
 */
export function checkAvailability(args: {
  interval: Interval;
  fleetStatus: string | null | undefined;
  existingBookings: readonly ExistingBooking[];
  /** Ignore this booking id when re-checking an existing booking being edited. */
  ignoreBookingId?: string | null;
}): AvailabilityVerdict {
  const { startsAt, endsAt } = args.interval;

  if (
    !(startsAt instanceof Date) ||
    !(endsAt instanceof Date) ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt.getTime() <= startsAt.getTime()
  ) {
    return { available: false, reason: "invalid_interval" };
  }

  if (!fleetStatusAllowsBooking(args.fleetStatus)) {
    return {
      available: false,
      reason: "vehicle_not_bookable",
      fleetStatus: args.fleetStatus ?? null,
    };
  }

  const conflicts = args.existingBookings
    .filter((b) => b.id !== args.ignoreBookingId)
    .filter((b) => blocksAvailability(b.status))
    .filter((b) =>
      intervalsOverlap(args.interval, { startsAt: toDate(b.starts_at), endsAt: toDate(b.ends_at) })
    )
    .map((b) => b.id);

  if (conflicts.length > 0) {
    return { available: false, reason: "conflict", conflictingBookingIds: conflicts };
  }
  return { available: true };
}

/** Whole days in a half-open interval, rounded up. Minimum 1. */
export function daysBetween(interval: Interval): number {
  const ms = interval.endsAt.getTime() - interval.startsAt.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}
