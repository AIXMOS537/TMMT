import { describe, expect, it } from "vitest";

import { computeRollup, detectRollupDrift, rollup, type RollupSpec } from "./rollups";

describe("rollup counts — three functions, three different questions", () => {
  const values = [1, 0, "", null, "text", 5];

  it("COUNTALL counts everything including blanks", () => {
    expect(rollup("COUNTALL", values)).toBe(6);
  });

  it("COUNTA counts non-blank values — 0 is NOT blank", () => {
    // 1, 0, "text", 5 -> 4. The zero counts; the "" and null do not.
    expect(rollup("COUNTA", values)).toBe(4);
  });

  it("COUNT counts only numeric values, ignoring text", () => {
    expect(rollup("COUNT", values)).toBe(3);
  });
});

describe("numeric aggregates — empty input must not read as zero", () => {
  it("SUM of nothing is 0, matching Airtable", () => {
    expect(rollup("SUM", [])).toBe(0);
    expect(rollup("SUM", [10, 20, 0.5])).toBeCloseTo(30.5, 6);
  });

  it("AVERAGE, MAX and MIN return BLANK on empty input, never 0", () => {
    // A 0 here would assert a measurement that was never taken.
    expect(rollup("AVERAGE", [])).toBeNull();
    expect(rollup("MAX", [])).toBeNull();
    expect(rollup("MIN", [])).toBeNull();
  });

  it("ignores non-numeric values rather than coercing them", () => {
    expect(rollup("SUM", [10, "20", null])).toBe(10);
    expect(rollup("AVERAGE", [10, 20])).toBeCloseTo(15, 6);
    expect(rollup("MAX", [-5, -1])).toBe(-1);
    expect(rollup("MIN", [-5, -1])).toBe(-5);
  });
});

describe("boolean aggregates", () => {
  it("AND is vacuously true on empty input", () => {
    expect(rollup("AND", [])).toBe(true);
    expect(rollup("AND", [true, 1, "x"])).toBe(true);
    expect(rollup("AND", [true, 0])).toBe(false);
  });

  it("OR is false on empty input", () => {
    expect(rollup("OR", [])).toBe(false);
    expect(rollup("OR", [false, null, 1])).toBe(true);
  });

  it("XOR is an ODD number of truthy operands, not exactly one", () => {
    expect(rollup("XOR", [true])).toBe(true);
    expect(rollup("XOR", [true, true])).toBe(false);
    expect(rollup("XOR", [true, true, true])).toBe(true);
  });
});

describe("array and text aggregates", () => {
  it("ARRAYCOMPACT drops blanks but keeps 0 and false", () => {
    expect(rollup("ARRAYCOMPACT", [1, null, "", 0, false])).toEqual([1, 0, false]);
  });

  it("ARRAYUNIQUE preserves first-seen order", () => {
    expect(rollup("ARRAYUNIQUE", ["b", "a", "b", "c"])).toEqual(["b", "a", "c"]);
  });

  it("ARRAYJOIN uses ', ' by default and honours a custom separator", () => {
    expect(rollup("ARRAYJOIN", ["a", null, "b"])).toBe("a, b");
    expect(rollup("ARRAYJOIN", ["a", "b"], " | ")).toBe("a | b");
  });

  it("CONCATENATE joins without a separator", () => {
    expect(rollup("CONCATENATE", ["a", null, "b"])).toBe("ab");
  });
});

describe("computeRollup — provenance separates 'no links' from 'sums to zero'", () => {
  const spec: RollupSpec = { name: "Ticket Balance", fn: "SUM", sourceField: "amount" };

  it("reports sourceCount 0 when there are no linked records", () => {
    const r = computeRollup(spec, []);
    // The value is 0 either way; only sourceCount tells the two situations apart.
    expect(r.value).toBe(0);
    expect(r.sourceCount).toBe(0);
    expect(r.contributingCount).toBe(0);
  });

  it("reports the real counts when linked records genuinely sum to zero", () => {
    const r = computeRollup(spec, [{ amount: 50 }, { amount: -50 }]);
    expect(r.value).toBe(0);
    expect(r.sourceCount).toBe(2);
    expect(r.contributingCount).toBe(2);
    expect(r.warnings).toEqual([]);
  });
});

describe("computeRollup — the PostgREST numeric-string trap", () => {
  const spec: RollupSpec = { name: "Ticket Balance", fn: "SUM", sourceField: "amount" };

  it("refuses to coerce numeric-looking strings, and says so loudly", () => {
    // Postgres numeric arrives over PostgREST as "500.00". Coercing would invent data;
    // staying quiet would return a plausible, wrong 0.
    const r = computeRollup(spec, [{ amount: "500.00" }, { amount: "250.00" }]);

    expect(r.value).toBe(0);
    expect(r.sourceCount).toBe(2);
    expect(r.contributingCount).toBe(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/numeric-looking STRINGS/);
    expect(r.warnings[0]).toMatch(/cast at the query boundary/);
  });

  it("stays silent when the values are genuinely numeric", () => {
    const r = computeRollup(spec, [{ amount: 500 }, { amount: 250 }]);
    expect(r.value).toBe(750);
    expect(r.warnings).toEqual([]);
  });

  it("flags a missing column, which is not the same as a recorded blank", () => {
    const r = computeRollup(spec, [{ amount: 10 }, { other: 1 }]);
    expect(r.warnings.some((w) => /absent from 1 of 2/.test(w))).toBe(true);
  });
});

describe("detectRollupDrift — recompute, never copy", () => {
  const spec: RollupSpec = { name: "Ticket Balance", fn: "SUM", sourceField: "amount" };

  it("passes a stored value that still matches", () => {
    const d = detectRollupDrift(spec, 150, [{ amount: 100 }, { amount: 50 }]);
    expect(d.stale).toBe(false);
    expect(d.detail).toMatch(/matches recomputation/);
  });

  it("catches a stored snapshot of a fact that has since moved", () => {
    const d = detectRollupDrift(spec, 150, [{ amount: 100 }, { amount: 50 }, { amount: 25 }]);
    expect(d.stale).toBe(true);
    expect(d.stored).toBe(150);
    expect(d.recomputed).toBe(175);
    expect(d.detail).toMatch(/STALE/);
  });

  it("reports blank-versus-zero as drift rather than smoothing it over", () => {
    const d = detectRollupDrift(spec, null, []);
    expect(d.stale).toBe(true);
    expect(d.detail).toMatch(/BLANK-versus-ZERO/);
    expect(d.detail).toMatch(/never recorded/);
  });

  it("compares array-valued rollups element-wise", () => {
    const arraySpec: RollupSpec = { name: "Plates", fn: "ARRAYCOMPACT", sourceField: "plate" };
    const fresh = detectRollupDrift(arraySpec, ["AAA", "BBB"], [{ plate: "AAA" }, { plate: "BBB" }]);
    expect(fresh.stale).toBe(false);

    const moved = detectRollupDrift(arraySpec, ["AAA"], [{ plate: "AAA" }, { plate: "BBB" }]);
    expect(moved.stale).toBe(true);
  });

  it("surfaces input warnings alongside a drift verdict", () => {
    const d = detectRollupDrift(spec, 750, [{ amount: "500.00" }, { amount: "250.00" }]);
    expect(d.stale).toBe(true);
    expect(d.detail).toMatch(/numeric-looking STRINGS/);
  });
});
