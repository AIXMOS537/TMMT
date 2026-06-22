import { describe, it, expect, beforeEach } from "vitest";
import {
  getBrandShell,
  listBrandShells,
  getBrandDisplay,
  getPlatformManifest,
  _resetBrandShellCache,
} from "./brand-shell";

describe("brand-shell", () => {
  beforeEach(() => {
    _resetBrandShellCache();
  });

  it("loads canonical tenants", () => {
    expect(getBrandShell("aixmos")?.displayName).toBe("AIXMOS");
    expect(getBrandShell("moe_legacy")?.displayName).toBe("Moe Legacy");
    expect(getBrandShell("tmmt_property")?.displayName).toBe("TMMT");
  });

  it("resolves aliases", () => {
    expect(getBrandShell("redhood")?.id).toBe("moe-legacy");
    expect(getBrandShell("tmmt")?.id).toBe("tmmt");
  });

  it("lists deduped shells", () => {
    const ids = listBrandShells().map((s) => s.id);
    expect(ids).toContain("aixmos");
    expect(ids.filter((id) => id === "aixmos")).toHaveLength(1);
  });

  it("falls back display safely", () => {
    const d = getBrandDisplay("unknown-org");
    expect(d.name).toBe("TMMT");
  });

  it("manifest names apex owner", () => {
    const m = getPlatformManifest();
    expect(m.apexOwner.name).toBe("PROJECT X HAILMARY");
    expect(m.platformId).toBe("aixmos-platform");
  });
});
