import { describe, it, expect } from "vitest";
import { makeFakeSupabase, writes } from "@/lib/testing/fake-supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKING_BLOCKED_MESSAGE,
  BOOKING_CONFLICT_MESSAGE,
  BOOKING_REJECTED_DATES_MESSAGE,
  createBooking,
  makeRefCode,
  mapBookingWriteError,
  type CreateBookingInput,
} from "./create-booking";

const RULE = {
  id: "r-econ", tier: "economy", make: null, model: null, year_min: null, year_max: null,
  daily_rate_cents: 4500, weekly_rate_cents: 28000, deposit_cents: 40000,
  match_priority: 0, active: true,
};
const SHIELD = {
  id: "i-econ", tier: "economy", coverage_source: "tmmt_internal", name: "TMMT Economy Shield",
  weekly_premium_cents: 3500, min_liability_cents: 25000000,
  requires_background_approved: true, active: true,
};

function input(over: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    // Shape copied from a real fleet row: Honda CRV 2024, $500 posted, $450 floor.
    fleetVehicle: { weekly_prices: ["500"], lowest_possible_price: "450", vehicle_status: "Available" },
    vehicleId: "veh-1",
    vehicle: { tier: "economy", make: "Honda", model: "CRV", year: 2024 },
    interval: { startsAt: new Date("2026-10-01T10:00:00Z"), endsAt: new Date("2026-10-08T10:00:00Z") },
    customer: { name: "Test Renter", email: "  Renter@Example.COM ", phone: "[phone removed]" },
    backgroundApproved: true,
    orgId: "org-1",
    existingBookings: [],
    ...over,
  };
}

function client(opts?: { insertError?: { code: string; message: string } }) {
  return makeFakeSupabase((call) => {
    if (call.table === "rental_pricing_rules") return { data: [RULE] };
    if (call.table === "rental_insurance_products") return { data: [SHIELD] };
    if (call.table === "bookings") {
      if (opts?.insertError) return { error: opts.insertError };
      return { data: { id: "bk-1", ref_code: "TMMT-ABC123" } };
    }
    return { data: [] };
  });
}

describe("makeRefCode", () => {
  it("is deterministic for a seed and avoids look-alike characters", () => {
    const a = makeRefCode("seed-1");
    expect(a).toBe(makeRefCode("seed-1"));
    expect(a).toMatch(/^TMMT-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(a).not.toMatch(/[ILO01]/);
  });

  it("differs across seeds", () => {
    expect(makeRefCode("seed-1")).not.toBe(makeRefCode("seed-2"));
  });
});

describe("createBooking — refuses before it writes", () => {
  it("does NOT touch the bookings table when the car is already booked", async () => {
    const c = client();
    const r = await createBooking(c as unknown as SupabaseClient, input({
      existingBookings: [{
        id: "b-existing", vehicle_id: "veh-1", status: "confirmed",
        starts_at: "2026-10-03T10:00:00Z", ends_at: "2026-10-05T10:00:00Z",
      }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unavailable");
    // The real assertion: no write reached the database.
    expect(writes(c).filter((w) => w.table === "bookings")).toEqual([]);
  });

  it("does not write when the car is Under Maintenance", async () => {
    const c = client();
    const r = await createBooking(c as unknown as SupabaseClient, input({
      fleetVehicle: { weekly_prices: ["500"], lowest_possible_price: "450", vehicle_status: "Under Maintenance" },
    }));
    expect(r.ok).toBe(false);
    expect(writes(c).filter((w) => w.table === "bookings")).toEqual([]);
  });

  it("refuses an unpriceable car rather than booking it at the tier rate", async () => {
    const c = makeFakeSupabase((call) =>
      call.table === "rental_pricing_rules" ? { data: [] } : { data: [SHIELD] }
    );
    const r = await createBooking(c as unknown as SupabaseClient, input({
      fleetVehicle: { weekly_prices: null, lowest_possible_price: null, vehicle_status: "Available" },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("quote_failed");
    expect(writes(c).filter((w) => w.table === "bookings")).toEqual([]);
  });

  it("REFUSES to write a rate below the car's own floor", async () => {
    const c = client();
    // Car posts nothing, floor is $450, tier card would quote $280.
    const r = await createBooking(c as unknown as SupabaseClient, input({
      fleetVehicle: { weekly_prices: null, lowest_possible_price: "450", vehicle_status: "Available" },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "below_floor") {
      expect(r.weeklyCents).toBe(28000);
      expect(r.floorWeeklyCents).toBe(45000);
    } else {
      throw new Error("expected below_floor refusal");
    }
    expect(writes(c).filter((w) => w.table === "bookings")).toEqual([]);
  });
});

describe("createBooking — the happy path", () => {
  it("writes a HOLD at the car's own posted price, not the tier card price", async () => {
    const c = client();
    const r = await createBooking(c as unknown as SupabaseClient, input(), { refSeed: "fixed" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const insert = writes(c).find((w) => w.table === "bookings");
    const row = insert?.payload as Record<string, unknown>;
    expect(row.status).toBe("hold");                 // never 'confirmed' — no money taken
    expect(row.quoted_weekly_cents).toBe(50000);     // $500 posted, NOT $280 card
    expect(row.quoted_deposit_cents).toBe(40000);
    expect(row.insurance_verified).toBe(false);
    expect(row.lot_release_approved).toBe(false);
    expect(row.org_id).toBe("org-1");
    expect((row.metadata as Record<string, unknown>).rate_source).toBe("fleet_posted");
  });

  it("normalises the customer email so the RLS self-read policy can match it", async () => {
    const c = client();
    await createBooking(c as unknown as SupabaseClient, input());
    const row = writes(c).find((w) => w.table === "bookings")?.payload as Record<string, unknown>;
    // bookings_email_read compares lower(customer_email) = lower(current_profile_email()).
    expect(row.customer_email).toBe("renter@example.com");
  });

  it("records coverage as pending when none was selected", async () => {
    const c = client();
    await createBooking(c as unknown as SupabaseClient, input());
    const row = writes(c).find((w) => w.table === "bookings")?.payload as Record<string, unknown>;
    expect(row.insurance_coverage_source).toBe("pending");
  });
});

describe("createBooking — losing the race", () => {
  it("turns a 23P01 exclusion violation into a clean conflict, not a crash", async () => {
    // This is what the database returns when another request took the car
    // between our availability check and our insert.
    const c = client({
      insertError: {
        code: "23P01",
        message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"',
      },
    });
    const r = await createBooking(c as unknown as SupabaseClient, input());
    expect(r).toEqual({ ok: false, reason: "conflict_race", message: BOOKING_CONFLICT_MESSAGE });
    expect(BOOKING_CONFLICT_MESSAGE).toBe("That car is already booked for those dates.");
  });

  it("says the car is blocked when a vehicle_block (not a booking) took the dates", async () => {
    const c = client({
      insertError: {
        code: "23P01",
        message: 'conflicting key value violates exclusion constraint "vehicle_occupancy_no_block_overlap"',
      },
    });
    const r = await createBooking(c as unknown as SupabaseClient, input());
    expect(r).toEqual({ ok: false, reason: "conflict_race", message: BOOKING_BLOCKED_MESSAGE });
  });

  it("turns a 23514 check violation into a user-facing refusal, not write_failed", async () => {
    const c = client({
      insertError: {
        code: "23514",
        message: 'new row for relation "bookings" violates check constraint "bookings_interval_sane"',
      },
    });
    const r = await createBooking(c as unknown as SupabaseClient, input());
    expect(r).toEqual({ ok: false, reason: "rejected_dates", message: BOOKING_REJECTED_DATES_MESSAGE });
  });

  it("treats a duplicate ref_code as a conflict too", async () => {
    const c = client({ insertError: { code: "23505", message: "duplicate key" } });
    const r = await createBooking(c as unknown as SupabaseClient, input());
    expect(r).toEqual({ ok: false, reason: "conflict_race", message: BOOKING_CONFLICT_MESSAGE });
  });

  it("surfaces any other write failure instead of swallowing it", async () => {
    const c = client({ insertError: { code: "42501", message: "permission denied" } });
    const r = await createBooking(c as unknown as SupabaseClient, input());
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "write_failed") {
      expect(r.detail).toBe("permission denied");
    } else {
      throw new Error("expected write_failed");
    }
  });
});

describe("mapBookingWriteError", () => {
  it("maps only the refusal codes and leaves everything else to write_failed", () => {
    expect(mapBookingWriteError({ code: "23P01", message: "x" })?.message).toBe(BOOKING_CONFLICT_MESSAGE);
    expect(mapBookingWriteError({ code: "23514", message: "x" })?.reason).toBe("rejected_dates");
    expect(mapBookingWriteError({ code: "42501", message: "permission denied" })).toBeNull();
    expect(mapBookingWriteError({ code: null, message: "network" })).toBeNull();
  });

  it("never leaks the raw database message to the user", () => {
    const raw = 'conflicting key value violates exclusion constraint "bookings_no_overlap"';
    const r = mapBookingWriteError({ code: "23P01", message: raw });
    expect(r?.message).not.toContain("constraint");
  });
});
