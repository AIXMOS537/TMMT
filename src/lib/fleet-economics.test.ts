import { describe, it, expect } from "vitest";
import {
  classifyStatus,
  pct,
  round2,
  computeFleetEconomics,
  type FleetVehicleInput,
  type RevenueInput,
  type CostInput,
} from "./fleet-economics";

describe("classifyStatus", () => {
  it("maps common fleet labels to buckets", () => {
    expect(classifyStatus("Rented")).toBe("rented");
    expect(classifyStatus("Available")).toBe("available");
    expect(classifyStatus("Under Maintenance")).toBe("maintenance");
    expect(classifyStatus("Needs Repair")).toBe("needs_repair");
    expect(classifyStatus("Sold")).toBe("other");
    expect(classifyStatus("")).toBe("other");
  });
});

describe("pct / round2", () => {
  it("never divides by zero", () => {
    expect(pct(3, 0)).toBe(0);
  });
  it("rounds to a whole/decimal percent", () => {
    expect(pct(1, 3)).toBe(33.33);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("computeFleetEconomics", () => {
  const vehicles: FleetVehicleInput[] = [
    { id: "1", name: "Model 3", status: "Rented", acquisitionCost: 30000 },
    { id: "2", name: "Model Y", status: "Available", acquisitionCost: 40000 },
    { id: "3", name: "Bolt", status: "Under Maintenance" },
    { id: "4", name: "Leaf", status: "Needs Repair", acquisitionCost: 0 },
  ];
  const revenue: RevenueInput[] = [
    { vehicle: "Model 3", amount: 1200, counts: true },
    { vehicle: "model 3", amount: 800, counts: true }, // case-insensitive merge
    { vehicle: "Model Y", amount: 500, counts: false }, // pending — excluded
    { vehicle: "Bolt", amount: 300, counts: true },
  ];
  const costs: CostInput[] = [
    { vehicle: "Model 3", amount: 200 },
    { vehicle: "Bolt", amount: 500 },
  ];

  const e = computeFleetEconomics(vehicles, revenue, costs);

  it("counts status buckets", () => {
    expect(e.fleetSize).toBe(4);
    expect(e.rented).toBe(1);
    expect(e.available).toBe(1);
    expect(e.maintenance).toBe(1);
    expect(e.needsRepair).toBe(1);
  });

  it("computes utilization both ways", () => {
    expect(e.utilizationPct).toBe(25); // 1/4
    expect(e.operationalUtilizationPct).toBe(50); // 1 rented / (1 rented + 1 available)
  });

  it("only counts payments flagged counts=true, case-insensitively", () => {
    const m3 = e.perVehicle.find((v) => v.name === "Model 3")!;
    expect(m3.revenue).toBe(2000); // 1200 + 800; the case variant merged
    const my = e.perVehicle.find((v) => v.name === "Model Y")!;
    expect(my.revenue).toBe(0); // its only payment was pending
  });

  it("nets revenue against per-vehicle cost", () => {
    const m3 = e.perVehicle.find((v) => v.name === "Model 3")!;
    expect(m3.cost).toBe(200);
    expect(m3.net).toBe(1800);
    expect(m3.roiPct).toBe(6); // 1800 / 30000 * 100
  });

  it("leaves ROI null when acquisition cost is unknown or zero", () => {
    const bolt = e.perVehicle.find((v) => v.name === "Bolt")!;
    expect(bolt.roiPct).toBeNull();
    const leaf = e.perVehicle.find((v) => v.name === "Leaf")!;
    expect(leaf.roiPct).toBeNull(); // acquisitionCost 0
  });

  it("rolls up fleet totals and ROI over known acquisition cost", () => {
    expect(e.totalRevenue).toBe(2300); // 2000 + 300 (Bolt)
    expect(e.totalCost).toBe(700); // 200 + 500
    expect(e.netProfit).toBe(1600);
    // total known acq cost = 30000 + 40000 = 70000 → 1600/70000*100
    expect(e.fleetRoiPct).toBe(2.29);
    expect(e.avgRevenuePerVehicle).toBe(575); // 2300 / 4
  });

  it("sorts vehicles by net, most profitable first", () => {
    expect(e.perVehicle[0].name).toBe("Model 3");
  });

  it("counts revenue/cost that doesn't match a vehicle in the fleet TOTALS", () => {
    // A payment attributed to a vehicle not in the fleet, and an untagged cost.
    const rev2: RevenueInput[] = [
      ...revenue,
      { vehicle: "Ghost Car", amount: 1000, counts: true },
    ];
    const costs2: CostInput[] = [...costs, { vehicle: null, amount: 50 }];
    const e2 = computeFleetEconomics(vehicles, rev2, costs2);
    // Totals include the unmatched money…
    expect(e2.totalRevenue).toBe(3300); // 2300 + 1000
    expect(e2.totalCost).toBe(750); // 700 + 50
    expect(e2.netProfit).toBe(2550);
    // …but no phantom vehicle row is invented.
    expect(e2.perVehicle.find((v) => v.name === "Ghost Car")).toBeUndefined();
    expect(e2.perVehicle).toHaveLength(vehicles.length);
  });

  it("handles an empty fleet without NaN/Infinity", () => {
    const empty = computeFleetEconomics([], [], []);
    expect(empty.fleetSize).toBe(0);
    expect(empty.utilizationPct).toBe(0);
    expect(empty.avgRevenuePerVehicle).toBe(0);
    expect(empty.fleetRoiPct).toBeNull();
  });
});
