import { describe, it, expect } from "vitest";
import { renderMissionForTelegram } from "./render-telegram";
import type { MissionBoardData } from "./types";

function sampleData(overrides: Partial<MissionBoardData> = {}): MissionBoardData {
  return {
    view: "owner",
    greetingName: "Moe",
    stats: [
      { label: "Fleet vehicles", value: 12, tone: "neutral" },
      { label: "Available now", value: 4, tone: "good" },
      { label: "Overdue payments", value: 2, tone: "alert" },
    ],
    neededFor: [
      { icon: "💸", title: "2 overdue payments", detail: "Review past-due balances.", agent: "bob" },
    ],
    growMoves: [
      { icon: "🚗", title: "Grow the fleet", detail: "Demand outpaces supply." },
    ],
    agents: [
      { key: "bob", label: "Bob", role: "Billing", status: "2 overdue", tone: "alert" },
    ],
    ...overrides,
  };
}

describe("renderMissionForTelegram", () => {
  it("includes greeting with name", () => {
    const out = renderMissionForTelegram(sampleData());
    expect(out).toContain("Moe");
    expect(out).toContain("🎯 MISSION");
  });

  it("renders each section header", () => {
    const out = renderMissionForTelegram(sampleData());
    expect(out).toContain("📡 What's happening now");
    expect(out).toContain("🎯 What you're needed for");
    expect(out).toContain("🚀 Grow & scale");
    expect(out).toContain("🤖 Agents on watch");
  });

  it("shows stat values with tone indicators", () => {
    const out = renderMissionForTelegram(sampleData());
    expect(out).toContain("Fleet vehicles: 12");
    expect(out).toContain("🟢 Available now: 4");
    expect(out).toContain("🔴 Overdue payments: 2");
  });

  it("renders null stat values as em dash", () => {
    const out = renderMissionForTelegram(
      sampleData({ stats: [{ label: "Pending", value: null, tone: "neutral" }] }),
    );
    expect(out).toContain("Pending: —");
  });

  it("includes agent tag on needed-for items", () => {
    const out = renderMissionForTelegram(sampleData());
    expect(out).toContain("[bob]");
  });

  it("omits ventures section when empty", () => {
    const out = renderMissionForTelegram(sampleData({ ventures: undefined }));
    expect(out).not.toContain("Ventures");
  });

  it("includes ventures section when present", () => {
    const out = renderMissionForTelegram(
      sampleData({ ventures: [{ name: "TMMT Auto", status: "live", note: "fleet at 12" }] }),
    );
    expect(out).toContain("🏢 Ventures");
    expect(out).toContain("TMMT Auto — live");
    expect(out).toContain("(fleet at 12)");
  });

  it("includes a date header when a real now is passed", () => {
    const out = renderMissionForTelegram(sampleData(), new Date("2026-06-09T15:00:00Z"));
    expect(out).toMatch(/Moe · \w+, \w+ \d+/);
  });

  it("truncates output above 4000 chars", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      icon: "•",
      title: `item ${i}`,
      detail: "x".repeat(50),
    }));
    const out = renderMissionForTelegram(sampleData({ neededFor: many }));
    expect(out.length).toBeLessThanOrEqual(4000);
    expect(out).toContain("…(truncated)");
  });
});
