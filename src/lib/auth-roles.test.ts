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

  it("grants staff only on an explicit staff role", () => {
    expect(getTierForUser(userWithRole("internal_team"))).toBe("staff");
    expect(getTierForUser(userWithRole("va"))).toBe("staff");
  });

  // The hole this replaced: no account in this project has app_metadata.role
  // set, so "default to staff" made isStaffUser() true for every signed-in
  // user — and four server actions gate a service-role client on that check.
  it("never grants a tier on an absent or unrecognised role", () => {
    expect(getTierForUser(userWithRole("nonsense"))).toBe("none");
    expect(getTierForUser(userWithRole("customer"))).toBe("none");
    expect(getTierForUser(userWithRole())).toBe("none");
    expect(getTierForUser(null)).toBe("none");
  });
});

describe("homePathForTier", () => {
  it("routes each tier to its landing path", () => {
    expect(homePathForTier("owner")).toBe("/command");
    expect(homePathForTier("executive")).toBe("/executive");
    expect(homePathForTier("operator")).toBe("/");
    expect(homePathForTier("vendor")).toBe("/vendor");
    expect(homePathForTier("investor")).toBe("/investor");
    expect(homePathForTier("staff")).toBe("/");
  });
});

describe("isStaffUser", () => {
  it("is true for staff and owner, false otherwise", () => {
    expect(isStaffUser(userWithRole("admin"))).toBe(true);
    expect(isStaffUser(userWithRole("internal_team"))).toBe(true);
    expect(isStaffUser(userWithRole("vendor"))).toBe(false);
    expect(isStaffUser(userWithRole("investor"))).toBe(false);
  });

  // This is the assertion that matters: it gates service-role access.
  it("is false for a signed-in user with no role, and for nobody", () => {
    expect(isStaffUser(userWithRole())).toBe(false);
    expect(isStaffUser(userWithRole("customer"))).toBe(false);
    expect(isStaffUser(null)).toBe(false);
  });
});
