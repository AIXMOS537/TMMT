import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate, statusColor } from "./utils";

describe("cn", () => {
  it("joins truthy classes and drops falsy ones", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatCurrency", () => {
  it("formats USD with two decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("returns an em dash for null/undefined", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("formatDate", () => {
  it("returns an em dash for empty input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("renders a mid-month date without crossing the year boundary", () => {
    // Mid-month avoids timezone-dependent day shifts changing the year.
    expect(formatDate("2026-06-15")).toContain("2026");
  });
});

describe("statusColor", () => {
  it("maps positive statuses to emerald", () => {
    expect(statusColor("Active")).toContain("emerald");
    expect(statusColor("Completed")).toContain("emerald");
  });

  it("maps risk statuses to red", () => {
    expect(statusColor("Overdue")).toContain("red");
    expect(statusColor("Critical")).toContain("red");
  });

  it("maps rented/qualified to blue", () => {
    expect(statusColor("Rented")).toContain("blue");
  });

  it("falls back to gray for null/unknown", () => {
    expect(statusColor(null)).toContain("gray");
    expect(statusColor("Wibble")).toContain("gray");
  });
});
