import { describe, it, expect } from "vitest";
import { buildScorecard, type TimeEntry } from "./scorecard";

const NOW = new Date("2026-06-15T12:00:00Z");

// Two 2-hour shifts for jane = 4h; one 1-hour shift for bob = 1h.
const time: TimeEntry[] = [
  { user_email: "jane@x.com", clock_in: "2026-06-10T09:00:00Z", clock_out: "2026-06-10T11:00:00Z" },
  { user_email: "jane@x.com", clock_in: "2026-06-11T09:00:00Z", clock_out: "2026-06-11T11:00:00Z" },
  { user_email: "bob@x.com", clock_in: "2026-06-12T09:00:00Z", clock_out: "2026-06-12T10:00:00Z" },
];

// jane's code is her email local-part; an "extra" code never clocked in.
const payments = [
  { payment_status: "Paid", amount: 400, notes: "aff: jane" },
  { payment_status: "Paid", amount: 200, notes: "x | aff: jane@x.com" },
  { payment_status: "Paid", amount: 1000, notes: "aff: ghost" },
];

describe("buildScorecard", () => {
  const rows = buildScorecard(time, payments, NOW);

  it("computes hours per clocked-in person", () => {
    expect(rows.find((r) => r.person === "jane@x.com")!.hours).toBe(4);
    expect(rows.find((r) => r.person === "bob@x.com")!.hours).toBe(1);
  });

  it("attributes sales to the matching person (email or local-part)", () => {
    const jane = rows.find((r) => r.person === "jane@x.com")!;
    expect(jane.revenue).toBe(600); // both jane sales
    expect(jane.matched).toBe(true);
    expect(jane.revPerHour).toBe(150); // 600 / 4h
  });

  it("shows a clocked-in person with no sales as zero, not missing", () => {
    const bob = rows.find((r) => r.person === "bob@x.com")!;
    expect(bob.revenue).toBe(0);
    expect(bob.paidSales).toBe(0);
  });

  it("surfaces unmatched affiliate codes (revenue not hidden)", () => {
    const ghost = rows.find((r) => r.person === "ghost")!;
    expect(ghost.revenue).toBe(1000);
    expect(ghost.hours).toBe(0);
    expect(ghost.matched).toBe(false);
    expect(ghost.revPerHour).toBeNull();
  });

  it("sorts best producers first", () => {
    expect(rows[0].person).toBe("ghost"); // 1000 > 600
    expect(rows[1].person).toBe("jane@x.com");
  });
});
