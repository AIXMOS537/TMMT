import { describe, it, expect } from "vitest";
import { isRateLimited } from "./rate-limit";

describe("isRateLimited", () => {
  it("allows the first 5 hits then blocks the 6th (per key)", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key)).toBe(false);
    }
    expect(isRateLimited(key)).toBe(true);
    expect(isRateLimited(key)).toBe(true); // stays blocked within the window
  });

  it("tracks keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) isRateLimited(a);
    expect(isRateLimited(a)).toBe(true); // a is maxed
    expect(isRateLimited(b)).toBe(false); // b is fresh
  });
});
