/**
 * The car's OWN posted rate, read off the live `fleet` row — and the floor
 * guard that stops any quote going out below it.
 *
 * WHY THIS EXISTS, AND WHY IT OVERRIDES THE RATE CARD (2026-09-16)
 * ---------------------------------------------------------------
 * `rental_pricing_rules` is a clean, seeded tier card (economy $280/wk, mid
 * $470, luxury $950). It is also WRONG for this fleet. Read from production
 * 2026-09-16, all 43 rows of `public.fleet`:
 *
 *   - real posted weekly prices run $300 -> $550   (33 of 43 rows carry one)
 *   - `lowest_possible_price` runs $300 -> $450    (16 of 43 rows carry one)
 *   - the cheapest real car on the lot is $300/wk
 *
 * The seeded economy rate of $280/wk is BELOW the cheapest car TMMT actually
 * rents. Quoting straight off the tier card would have undercut the real rate
 * on every single vehicle, by $20 to $270 a week. On a 43-car fleet that is
 * four figures a week walking out the door, silently, with a green checkmark
 * over it.
 *
 * So the precedence is: the car's own posted price wins. The tier card is a
 * fallback for a car that has no price of its own, never an override.
 *
 * `vehicle_class` is NOT usable as a tier. Only 3 of 43 rows have one and all
 * three are wrong in production today: a Tesla Model 3 is filed as
 * "sport_bike", a 2013 Corolla as "sport_car", a Model Y as "sport_suv".
 * Tier must therefore be supplied deliberately by a human or inferred from
 * price, never read from that column.
 */

/** Dollars-as-text (Airtable's legacy shape) -> integer cents. Null on junk. */
export function dollarsToCents(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "number" ? String(value) : String(value);
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export type FleetPriceRow = {
  /** Airtable legacy: an ARRAY of dollar strings, e.g. ["450"]. */
  weekly_prices?: unknown;
  /** The negotiation floor, in dollars. Named exactly what it means. */
  lowest_possible_price?: unknown;
};

export type FleetRate = {
  /** List price per week, in cents. Null when the car has no posted price. */
  listWeeklyCents: number | null;
  /** Hard floor per week, in cents. Null when none is recorded. */
  floorWeeklyCents: number | null;
};

/**
 * Reads the two money columns off a fleet row.
 * `weekly_prices` is an array; the first entry is the posted rate.
 */
export function readFleetRate(row: FleetPriceRow): FleetRate {
  const arr = Array.isArray(row.weekly_prices) ? row.weekly_prices : [];
  const listWeeklyCents = arr.length > 0 ? dollarsToCents(arr[0]) : null;
  const floorWeeklyCents = dollarsToCents(row.lowest_possible_price);
  return { listWeeklyCents, floorWeeklyCents };
}

export type FloorVerdict =
  | { ok: true; weeklyCents: number }
  | { ok: false; reason: "below_floor"; weeklyCents: number; floorWeeklyCents: number };

/**
 * THE GUARD. A quoted weekly rate may never go out below the car's recorded
 * `lowest_possible_price`.
 *
 * This refuses rather than silently clamping upward. A clamp would hide the
 * fact that somebody — a discount rule, a tier fallback, an operator typo —
 * tried to rent the car under its floor, and hiding that is how the money
 * leaks. The caller must see the refusal and decide.
 *
 * A car with no recorded floor passes through: no floor is not a zero floor.
 */
export function enforceFloor(weeklyCents: number, rate: FleetRate): FloorVerdict {
  if (rate.floorWeeklyCents === null) return { ok: true, weeklyCents };
  if (weeklyCents < rate.floorWeeklyCents) {
    return {
      ok: false,
      reason: "below_floor",
      weeklyCents,
      floorWeeklyCents: rate.floorWeeklyCents,
    };
  }
  return { ok: true, weeklyCents };
}

/**
 * Which weekly rate should actually be quoted for this car.
 *
 * Precedence, highest first:
 *   1. the car's own posted weekly price  (real money TMMT charges today)
 *   2. the tier card's weekly rate        (fallback for an unpriced car)
 *
 * Returns null when neither exists — an unpriced car in an unknown tier is not
 * quotable, and inventing a number for it is exactly the failure this module
 * was written to prevent.
 */
export function resolveWeeklyCents(args: {
  rate: FleetRate;
  tierCardWeeklyCents?: number | null;
}): { weeklyCents: number; source: "fleet_posted" | "tier_card" } | null {
  if (args.rate.listWeeklyCents !== null) {
    return { weeklyCents: args.rate.listWeeklyCents, source: "fleet_posted" };
  }
  if (typeof args.tierCardWeeklyCents === "number" && args.tierCardWeeklyCents > 0) {
    return { weeklyCents: args.tierCardWeeklyCents, source: "tier_card" };
  }
  return null;
}
