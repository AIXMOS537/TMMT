import { describe, expect, it } from "vitest";
import { commandHubSections, commandHubSectionsFor } from "./command-hub-nav";

/**
 * These tests exist because the command hub used to hardcode "TMMT" and
 * allinonemanagementsolutions.com. A white-labelled operator opened their own
 * command centre and saw someone else's brand, and a "Public site" link pointing
 * at the AIXMOS tenant's domain.
 *
 * The filtering is the whole point, so it is tested by watching it EXCLUDE —
 * asserting only that TMMT still sees its links would pass even if the filter
 * did nothing at all.
 */

const tmmt = {
  slug: "tmmt_property",
  domains: { marketing: "tmmtrentals.com" },
};
const operator = {
  slug: "some_operator",
  domains: { marketing: "operator-example.com" },
};

const flatten = (s: ReturnType<typeof commandHubSectionsFor>) =>
  s.flatMap((x) => x.links);

describe("commandHubSectionsFor — tenant gating", () => {
  it("hides TMMT's own-entity links from an unrelated operator", () => {
    const labels = flatten(commandHubSectionsFor(operator)).map((l) => l.label);
    const descriptions = flatten(commandHubSectionsFor(operator)).map(
      (l) => l.description,
    );

    // the upgrade ladder is TMMT's business, not a product feature
    expect(labels.some((l) => l.includes("AIXMOS ladder"))).toBe(false);
    // cross-entity handoffs between Taha's own companies
    expect(descriptions.some((d) => d.includes("Cross-entity"))).toBe(false);
    // TMMT's ClickUp workspace
    expect(descriptions.some((d) => d.includes("TMMT RENTALS"))).toBe(false);
  });

  it("still shows those links to TMMT itself", () => {
    const labels = flatten(commandHubSectionsFor(tmmt)).map((l) => l.label);
    expect(labels.some((l) => l.includes("AIXMOS ladder"))).toBe(true);
  });

  it("leaves no TMMT-branded text in an operator's hub", () => {
    const text = flatten(commandHubSectionsFor(operator))
      .map((l) => `${l.label} ${l.description}`)
      .join(" ");
    expect(text).not.toMatch(/TMMT/);
    expect(text).not.toMatch(/allinonemanagementsolutions/);
  });

  it("points the public-site link at the tenant's own marketing host", () => {
    const hrefs = flatten(commandHubSectionsFor(operator)).map((l) => l.href);
    expect(hrefs).toContain("https://operator-example.com/");
    expect(hrefs.some((h) => h.includes("allinonemanagementsolutions"))).toBe(
      false,
    );
  });

  it("drops the public-site link entirely when the tenant has no marketing host", () => {
    const hrefs = flatten(
      commandHubSectionsFor({ slug: "hostless", domains: {} }),
    ).map((h) => h.href);
    // a dead placeholder link is worse than no link
    expect(hrefs.some((h) => h.includes("__MARKETING_SITE__"))).toBe(false);
  });

  it("never returns an empty section", () => {
    for (const section of commandHubSectionsFor(operator)) {
      expect(section.links.length).toBeGreaterThan(0);
    }
  });

  it("does not mutate the shared base nav between tenants", () => {
    const before = JSON.stringify(commandHubSections);
    commandHubSectionsFor(tmmt);
    commandHubSectionsFor(operator);
    expect(JSON.stringify(commandHubSections)).toBe(before);
  });
});
