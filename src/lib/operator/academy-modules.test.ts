import { describe, it, expect } from "vitest";
import { ACADEMY_MODULES, academyModuleById } from "./academy-modules";

describe("ACADEMY_MODULES", () => {
  it("ships 15 modules with stable ids", () => {
    expect(ACADEMY_MODULES).toHaveLength(15);
    expect(new Set(ACADEMY_MODULES.map((m) => m.id)).size).toBe(15);
    expect(academyModuleById("lec-12")?.title).toMatch(/mom-and-pop/i);
  });
});
