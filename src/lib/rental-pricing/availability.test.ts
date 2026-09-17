import { describe, it, expect } from "vitest";
import {
  BLOCKING_STATUSES,
  BOOKING_STATUSES,
  blocksAvailability,
  checkAvailability,
  daysBetween,
  fleetStatusAllowsBooking,
  intervalsOverlap,
  isBookingStatus,
  type ExistingBooking,
} from "./availability";

const d = (s: string) => new Date(s);
const IV = { startsAt: d("2026-10-01T10:00:00Z"), endsAt: d("2026-10-08T10:00:00Z") };

function booking(over: Partial<ExistingBooking> = {}): ExistingBooking {
  return {
    id: "b-1",
    vehicle_id: "v-1",
    status: "confirmed",
    starts_at: "2026-10-03T10:00:00Z",
    ends_at: "2026-10-05T10:00:00Z",
    ...over,
  };
}

describe("status vocabulary", () => {
  it("only hold/confirmed/active hold a car off the market", () => {
    expect([...BLOCKING_STATUSES]).toEqual(["hold", "confirmed", "active"]);
    for (const s of ["completed", "cancelled", "no_show"]) {
      expect(blocksAvailability(s)).toBe(false);
    }
  });

  it("an unrecognised status does not block — it is not a real booking", () => {
    expect(blocksAvailability("banana")).toBe(false);
    expect(isBookingStatus("banana")).toBe(false);
    for (const s of BOOKING_STATUSES) expect(isBookingStatus(s)).toBe(true);
  });
});

describe("intervalsOverlap — half-open [start, end)", () => {
  it("does NOT block same-day turnaround: one ends exactly when the next starts", () => {
    const a = { startsAt: d("2026-10-01T10:00:00Z"), endsAt: d("2026-10-08T10:00:00Z") };
    const b = { startsAt: d("2026-10-08T10:00:00Z"), endsAt: d("2026-10-15T10:00:00Z") };
    expect(intervalsOverlap(a, b)).toBe(false);
    expect(intervalsOverlap(b, a)).toBe(false);
  });

  it("catches an overlap by a single minute", () => {
    const a = { startsAt: d("2026-10-01T10:00:00Z"), endsAt: d("2026-10-08T10:00:00Z") };
    const b = { startsAt: d("2026-10-08T09:59:00Z"), endsAt: d("2026-10-15T10:00:00Z") };
    expect(intervalsOverlap(a, b)).toBe(true);
  });

  it("catches full containment in both directions", () => {
    const outer = { startsAt: d("2026-10-01T00:00:00Z"), endsAt: d("2026-11-01T00:00:00Z") };
    const inner = { startsAt: d("2026-10-10T00:00:00Z"), endsAt: d("2026-10-12T00:00:00Z") };
    expect(intervalsOverlap(outer, inner)).toBe(true);
    expect(intervalsOverlap(inner, outer)).toBe(true);
  });
});

describe("fleetStatusAllowsBooking", () => {
  it("allows only Available, case-insensitively", () => {
    expect(fleetStatusAllowsBooking("Available")).toBe(true);
    expect(fleetStatusAllowsBooking(" available ")).toBe(true);
  });

  it("refuses every other real production status, including null", () => {
    // These are the actual values in fleet.vehicle_status today.
    for (const s of ["Rented", "Under Maintenance", "Coming Soon", "Retired"]) {
      expect(fleetStatusAllowsBooking(s)).toBe(false);
    }
    expect(fleetStatusAllowsBooking(null)).toBe(false);
    expect(fleetStatusAllowsBooking(undefined)).toBe(false);
  });
});

describe("checkAvailability — the double-booking guarantee", () => {
  it("books a free, available car", () => {
    expect(
      checkAvailability({ interval: IV, fleetStatus: "Available", existingBookings: [] })
    ).toEqual({ available: true });
  });

  it("REFUSES a car already confirmed to someone else over those dates", () => {
    const r = checkAvailability({
      interval: IV,
      fleetStatus: "Available",
      existingBookings: [booking()],
    });
    expect(r.available).toBe(false);
    if (!r.available && r.reason === "conflict") {
      expect(r.conflictingBookingIds).toEqual(["b-1"]);
    } else {
      throw new Error("expected a conflict verdict");
    }
  });

  it("refuses a car that is Under Maintenance even with an empty calendar", () => {
    const r = checkAvailability({
      interval: IV,
      fleetStatus: "Under Maintenance",
      existingBookings: [],
    });
    expect(r).toEqual({
      available: false,
      reason: "vehicle_not_bookable",
      fleetStatus: "Under Maintenance",
    });
  });

  it("lets a cancelled or completed booking release the car", () => {
    for (const status of ["cancelled", "completed", "no_show"]) {
      const r = checkAvailability({
        interval: IV,
        fleetStatus: "Available",
        existingBookings: [booking({ status })],
      });
      expect(r).toEqual({ available: true });
    }
  });

  it("reports EVERY conflicting booking, not just the first", () => {
    const r = checkAvailability({
      interval: IV,
      fleetStatus: "Available",
      existingBookings: [
        booking({ id: "b-1" }),
        booking({ id: "b-2", status: "hold", starts_at: "2026-10-06T00:00:00Z", ends_at: "2026-10-07T00:00:00Z" }),
        booking({ id: "b-3", status: "cancelled" }),
      ],
    });
    if (!r.available && r.reason === "conflict") {
      expect(r.conflictingBookingIds.sort()).toEqual(["b-1", "b-2"]);
    } else {
      throw new Error("expected a conflict verdict");
    }
  });

  it("ignores the booking being edited when re-checking it", () => {
    const r = checkAvailability({
      interval: IV,
      fleetStatus: "Available",
      existingBookings: [booking({ id: "b-1" })],
      ignoreBookingId: "b-1",
    });
    expect(r).toEqual({ available: true });
  });

  it("refuses a backwards or zero-length interval", () => {
    const back = { startsAt: d("2026-10-08T10:00:00Z"), endsAt: d("2026-10-01T10:00:00Z") };
    expect(checkAvailability({ interval: back, fleetStatus: "Available", existingBookings: [] }))
      .toEqual({ available: false, reason: "invalid_interval" });

    const zero = { startsAt: d("2026-10-01T10:00:00Z"), endsAt: d("2026-10-01T10:00:00Z") };
    expect(checkAvailability({ interval: zero, fleetStatus: "Available", existingBookings: [] }))
      .toEqual({ available: false, reason: "invalid_interval" });
  });

  it("refuses an unparseable date rather than treating it as open-ended", () => {
    const bad = { startsAt: new Date("not a date"), endsAt: d("2026-10-08T10:00:00Z") };
    expect(checkAvailability({ interval: bad, fleetStatus: "Available", existingBookings: [] }))
      .toEqual({ available: false, reason: "invalid_interval" });
  });

  it("checks the vehicle status BEFORE the calendar, so a retired car never looks bookable", () => {
    const r = checkAvailability({
      interval: IV,
      fleetStatus: "Retired",
      existingBookings: [booking()],
    });
    if (r.available) throw new Error("expected refusal");
    expect(r.reason).toBe("vehicle_not_bookable");
  });
});

describe("daysBetween", () => {
  it("counts a one-week rental as 7 days", () => {
    expect(daysBetween(IV)).toBe(7);
  });

  it("rounds a partial day up and never returns zero", () => {
    expect(daysBetween({ startsAt: d("2026-10-01T10:00:00Z"), endsAt: d("2026-10-01T11:00:00Z") })).toBe(1);
  });
});
