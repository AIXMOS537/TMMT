import { describe, it, expect } from "vitest";
import { brandCssText, brandTokens, contrastOn, luminance, mix, parseHex } from "./brand-tokens";
import { TENANTS } from "./tenant-map.generated";

describe("parseHex", () => {
  it("reads long and short form", () => {
    expect(parseHex("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("#F0A")).toEqual({ r: 255, g: 0, b: 170 });
  });
  it("rejects garbage instead of throwing", () => {
    expect(parseHex("rgb(0,0,0)")).toBeNull();
  });
});

describe("luminance / contrastOn", () => {
  it("puts dark ink on light brands", () => {
    expect(contrastOn("#7fffd4")).toBe("#000000");
    expect(contrastOn("#0a0a0a")).toBe("#ffffff");
  });
  it("orders dark below light", () => {
    expect(luminance("#000000")).toBeLessThan(luminance("#7fffd4"));
  });
});

describe("mix", () => {
  it("interpolates between two colors", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("brandTokens", () => {
  it("emits authored colors", () => {
    const tokens = brandTokens(TENANTS.aixmos_credit.theme);
    expect(tokens["--brand-primary"]).toBe("#34d399");
    expect(tokens["--brand-primary-ink"]).toBe("#000000");
  });
  it("substitutes safe colors on bad input", () => {
    const tokens = brandTokens({
      primary: "not-a-color",
      accent: "",
      background: "#0a0a0a",
      foreground: "#ffffff",
    });
    expect(tokens["--brand-primary"]).toBe("#7fffd4");
  });
  it("produces hex tokens for every real tenant", () => {
    for (const brand of Object.values(TENANTS)) {
      for (const [name, value] of Object.entries(brandTokens(brand.theme))) {
        expect(value, `${brand.slug} ${name}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe("brandCssText", () => {
  it("wraps tokens in a scoped rule", () => {
    const css = brandCssText(TENANTS.aixmos.theme, '[data-brand="aixmos"]');
    expect(css).toContain("--brand-primary: #7fffd4;");
  });
});
