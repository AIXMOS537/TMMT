import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POCKET_TILES } from "@/lib/pocket";

/**
 * The hub renders ICONS[tile.key]. A key with no entry in that map is not an
 * error — it renders nothing, so the tile ships with an empty blue square and
 * looks like a loading state that never finishes. Adding a tile to the
 * registry and forgetting the icon is a one-line miss with no failure, which
 * is exactly the kind that survives review.
 */

const HUB = readFileSync(
  join(process.cwd(), "src", "app", "(pocket)", "pocket", "page.tsx"),
  "utf8",
);

describe("every pocket tile can actually render", () => {
  it("has an icon for every registered key", () => {
    for (const tile of POCKET_TILES) {
      expect(
        new RegExp(`^\\s*${tile.key}:`, "m").test(HUB),
        `tile "${tile.key}" has no entry in ICONS — it will render an empty square`,
      ).toBe(true);
    }
  });

  it("points every tile at an in-app route", () => {
    for (const tile of POCKET_TILES) {
      expect(tile.href.startsWith("/"), `tile "${tile.key}" leaves the app`).toBe(true);
    }
  });

  it("gives every tile a title and a blurb", () => {
    for (const tile of POCKET_TILES) {
      expect(tile.title.trim().length, `tile "${tile.key}" has no title`).toBeGreaterThan(0);
      expect(tile.blurb.trim().length, `tile "${tile.key}" has no blurb`).toBeGreaterThan(10);
    }
  });

  it("has unique keys, since the icon map is keyed on them", () => {
    const keys = POCKET_TILES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reaches the see-it-stop-it page, which was unreachable before this", () => {
    const agents = POCKET_TILES.find((t) => t.href === "/pocket/agents");
    expect(agents, "the agent view and its stop button are orphaned again").toBeDefined();
    // Member-only: the page lists one organisation's agents and carries a
    // button that pauses them. A signed-out visitor routes to activation.
    expect(agents!.memberOnly).toBe(true);
  });

  it("names the stop button as something a worried person would click", () => {
    const agents = POCKET_TILES.find((t) => t.href === "/pocket/agents")!;
    const copy = `${agents.title} ${agents.blurb}`.toLowerCase();
    // Somebody reaching for this tile is usually reaching for the brake. The
    // copy has to say so on the hub, not only once they are inside.
    expect(copy, "the hub copy does not tell a worried customer they can stop it").toContain("stop");
  });
});
