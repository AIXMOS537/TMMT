import { describe, it, expect } from "vitest";
import { buildOwnerMissionData } from "./build";
import type { getDashboardData } from "@/lib/queries";

type Dashboard = Awaited<ReturnType<typeof getDashboardData>>;

// Build a dashboard payload with sensible zero defaults, overridable per test.
function dashboard(overrides: Partial<{
  overdue: number; openTickets: number; pendingChecks: number;
  newLeads: number; maintenance: number; waitlist: number;
}> = {}): Dashboard {
  const o = { overdue: 0, openTickets: 0, pendingChecks: 0, newLeads: 0, maintenance: 0, waitlist: 0, ...overrides };
  return {
    fleet: { total: 10, available: 6, rented: 3, maintenance: o.maintenance },
    leads: { total: 5, new: o.newLeads, qualified: 2 },
    bgChecks: { total: 4, pending: o.pendingChecks },
    waitlist: o.waitlist,
    customers: { total: 20, active: 18 },
    tickets: { total: 7, open: o.openTickets },
    payments: { total: 30, overdue: o.overdue },
    recentLeads: [],
    recentTickets: [],
  };
}

describe("buildOwnerMissionData", () => {
  it("always produces 8 stats and passes through the greeting name", () => {
    const data = buildOwnerMissionData(dashboard(), "PROJECT X HAILMARY");
    expect(data.view).toBe("owner");
    expect(data.greetingName).toBe("PROJECT X HAILMARY");
    expect(data.stats).toHaveLength(8);
  });

  it("shows the all-clear item when nothing needs attention", () => {
    const data = buildOwnerMissionData(dashboard());
    expect(data.neededFor).toHaveLength(1);
    expect(data.neededFor[0].title).toBe("All clear");
  });

  it("surfaces each non-zero queue and pluralizes correctly", () => {
    const data = buildOwnerMissionData(dashboard({ overdue: 1, openTickets: 2, pendingChecks: 3, newLeads: 0 }));
    const titles = data.neededFor.map((n) => n.title);
    expect(titles).toContain("1 overdue payment");
    expect(titles).toContain("2 open tickets");
    expect(titles).toContain("3 background checks pending");
    // newLeads is 0, so no lead item and no all-clear fallback.
    expect(titles.some((t) => t.includes("new lead"))).toBe(false);
    expect(titles).not.toContain("All clear");
  });

  it("flips agent tone to alert when payments are overdue", () => {
    const data = buildOwnerMissionData(dashboard({ overdue: 5 }));
    const bob = data.agents.find((a) => a.key === "bob");
    expect(bob?.tone).toBe("alert");
    expect(bob?.status).toBe("5 overdue");
  });

  it("keeps billing agent green when nothing is overdue", () => {
    const bob = buildOwnerMissionData(dashboard()).agents.find((a) => a.key === "bob");
    expect(bob?.tone).toBe("good");
    expect(bob?.status).toBe("All paid");
  });
});
