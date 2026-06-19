import { describe, it, expect } from "vitest";
import { scanCompliance, enforceCompliance } from "@/lib/compliance";

describe("compliance guard", () => {
  it("passes clean guidance text untouched", () => {
    const t = "I can help you build a credit guidance plan and learn the next step.";
    const r = enforceCompliance(t);
    expect(r.violations).toEqual([]);
    expect(r.blocked).toBe(false);
    expect(r.text).toBe(t);
  });

  it("rewrites 'credit repair' to 'credit guidance'", () => {
    const r = enforceCompliance("We offer credit repair services.");
    expect(r.violations).toContain("credit repair");
    expect(r.text.toLowerCase()).toContain("credit guidance");
    expect(r.text.toLowerCase()).not.toContain("credit repair");
  });

  it("blocks to a safe fallback when a guarantee survives", () => {
    const r = enforceCompliance("We guarantee your score will jump 100%.");
    expect(r.blocked).toBe(false); // 'guarantee' -> 'may help', '100%' removed
    expect(r.text.toLowerCase()).not.toContain("guarantee");
    expect(r.text).not.toContain("100%");
  });

  it("flags fix-your-credit phrasing", () => {
    const r = enforceCompliance("Let me fix your credit fast.");
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.text.toLowerCase()).not.toContain("fix your credit");
  });

  it("scan is read-only and finds violations", () => {
    expect(scanCompliance("credit repair").length).toBe(1);
    expect(scanCompliance("totally clean text").length).toBe(0);
  });
});
