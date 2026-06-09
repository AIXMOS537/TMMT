import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { getTierForUser, homePathForTier, isStaffUser } from "./auth-roles";

// Minimal User stub — only app_metadata.role is read by these helpers.
function userWithRole(role?: string): User {
  return { app_metadata: role ? { role } : {} } as unknown as User;
}

describe("getTierForUser", () => {
  it("maps roles to tiers", () => {
    expect(getTierForUser(userWithRole("admin"))).toBe("owner");
    expect(getTierForUser(userWithRole("executive"))).toBe("executive");
    expect(getTierForUser(userWithRole("executive_va"))).toBe("executive");
    expect(getTierForUser(userWithRole("operator"))).toBe("operator");
    expect(getTierForUser(userWithRole("vendor"))).toBe("vendor");
    expect(getTierForUser(userWithRole("investor"))).toBe("investor");
    expect(getTierForUser(userWithRole("partner"))).toBe("investor");
  });

  it("defaults unknown / missing roles to staff", () => {
    expect(getTierForUser(userWithRole("nonsense"))).toBe("staff");
    expect(getTierForUser(userWithRole())).toBe("staff");
    expect(getTierForUser(null)).toBe("staff");
  });
});

describe("homePathForTier", () => {
  it("routes each tier to its landing path", () => {
    expect(homePathForTier("owner")).toBe("/command");
    expect(homePathForTier("executive")).toBe("/executive");
    expect(homePathForTier("operator")).toBe("/operator");
    expect(homePathForTier("vendor")).toBe("/vendor");
    expect(homePathForTier("investor")).toBe("/investor");
    expect(homePathForTier("staff")).toBe("/");
  });
});

describe("isStaffUser", () => {
  it("is true for staff and owner, false otherwise", () => {
    expect(isStaffUser(userWithRole("admin"))).toBe(true);
    expect(isStaffUser(userWithRole())).toBe(true);
    expect(isStaffUser(userWithRole("vendor"))).toBe(false);
    expect(isStaffUser(userWithRole("investor"))).toBe(false);
  });
});
