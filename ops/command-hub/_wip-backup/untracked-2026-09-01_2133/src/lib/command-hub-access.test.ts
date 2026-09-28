import { describe, expect, it } from "vitest";
import {
  allowedCommandHubHrefs,
  canSeeCommandHubLink,
  COMMAND_HUB_HREF,
  hiddenCommandHubCount,
  visibleCommandHubSections,
  type CommandHubViewer,
} from "./command-hub-access";
import { commandHubSections, type CommandHubLink } from "./command-hub-nav";

const allLinks = commandHubSections.flatMap((s) => s.links);
const linkFor = (href: string): CommandHubLink => {
  const link = allLinks.find((l) => l.href === href);
  if (!link) throw new Error(`no command hub link for ${href}`);
  return link;
};

function viewer(overrides: Partial<CommandHubViewer> = {}): CommandHubViewer {
  return {
    tier: "staff",
    isOwner: false,
    licenseTier: null,
    modules: null,
    entitlements: null,
    integrations: { clickup: true, ghl: true },
    ...overrides,
  };
}

describe("canSeeCommandHubLink", () => {
  it("shows core links to staff", () => {
    expect(canSeeCommandHubLink(linkFor("/leads"), viewer())).toBe(true);
  });

  it("hides module links when the org licensed other modules", () => {
    const v = viewer({ licenseTier: "custom", modules: ["dispatch_core", "agent_sales"] });
    expect(canSeeCommandHubLink(linkFor("/fleet"), v)).toBe(false);
    expect(canSeeCommandHubLink(linkFor("/dispatch"), v)).toBe(true);
    expect(canSeeCommandHubLink(linkFor("/leads"), v)).toBe(true);
  });

  it("treats full_os as every module", () => {
    const v = viewer({ licenseTier: "full_os", modules: [] });
    expect(canSeeCommandHubLink(linkFor("/fleet"), v)).toBe(true);
    expect(canSeeCommandHubLink(linkFor("/operators"), v)).toBe(true);
  });

  it("treats a missing license row as unrestricted", () => {
    expect(canSeeCommandHubLink(linkFor("/fleet"), viewer({ modules: null }))).toBe(true);
  });

  it("applies package entitlements when the profile has a package", () => {
    const licensed = { licenseTier: "full_os", modules: [] };
    const withoutUpgrade = viewer({ ...licensed, entitlements: ["rental_hub"] });
    const withUpgrade = viewer({ ...licensed, entitlements: ["upgrade_center"] });
    expect(canSeeCommandHubLink(linkFor("/upgrade"), withoutUpgrade)).toBe(false);
    expect(canSeeCommandHubLink(linkFor("/upgrade"), withUpgrade)).toBe(true);
  });

  it("ignores entitlement gates when no package is on file", () => {
    expect(canSeeCommandHubLink(linkFor("/upgrade"), viewer({ entitlements: null }))).toBe(true);
  });

  it("hides links for connections that are not configured — owner included", () => {
    const clickup = allLinks.find((l) => l.requires?.integration === "clickup")!;
    const off = viewer({ isOwner: true, tier: "owner", integrations: { clickup: false, ghl: false } });
    expect(canSeeCommandHubLink(clickup, off)).toBe(false);
    expect(canSeeCommandHubLink(clickup, viewer())).toBe(true);
  });

  it("keeps owner-only links off the staff hub", () => {
    expect(canSeeCommandHubLink(linkFor("/command/desk"), viewer())).toBe(false);
    expect(
      canSeeCommandHubLink(linkFor("/command/desk"), viewer({ tier: "owner", isOwner: true }))
    ).toBe(true);
  });

  it("lets the owner past module and entitlement gates", () => {
    const v = viewer({
      tier: "owner",
      isOwner: true,
      licenseTier: "custom",
      modules: [],
      entitlements: [],
    });
    expect(allLinks.every((link) => canSeeCommandHubLink(link, v))).toBe(true);
  });

  it("shows nothing to portal tiers that are not owner or staff", () => {
    for (const tier of ["executive", "operator", "investor", "vendor"] as const) {
      expect(visibleCommandHubSections(viewer({ tier }))).toHaveLength(0);
      expect(allowedCommandHubHrefs(viewer({ tier }))).toEqual([]);
    }
  });
});

describe("allowedCommandHubHrefs", () => {
  it("includes the hub itself for staff and owner", () => {
    expect(allowedCommandHubHrefs(viewer())).toContain(COMMAND_HUB_HREF);
  });

  it("drops empty sections and counts what was hidden", () => {
    const v = viewer({ licenseTier: "custom", modules: [] });
    const titles = visibleCommandHubSections(v).map((s) => s.title);
    expect(titles).not.toContain("Fleet & rentals");
    expect(titles).not.toContain("Federation");
    expect(hiddenCommandHubCount(v)).toBeGreaterThan(0);
    expect(hiddenCommandHubCount(viewer({ tier: "owner", isOwner: true }))).toBe(0);
  });
});
