import { describe, it, expect } from "vitest";
import {
  MODULE_CATALOG,
  MODULE_LAYERS,
  MODULE_LAYER_LABEL,
  MODULE_LAYER_BLURB,
  ENTITLEMENT_IDS,
  modulesInLayer,
  moduleById,
  resolveSelection,
  describeSelection,
} from "./catalog";

/**
 * This file exists to stop the catalogue drifting into marketing. Every
 * assertion below is a claim we would have to defend to a customer, so each
 * one is written to fail loudly rather than to pass quietly.
 */

describe("catalogue shape", () => {
  it("has no duplicate ids", () => {
    const ids = MODULE_CATALOG.map((m) => m.id);
    expect(new Set(ids).size, `duplicate module id in the catalogue: ${ids.join(", ")}`).toBe(
      ids.length,
    );
  });

  it("puts every module in a real layer, and leaves no layer empty", () => {
    for (const m of MODULE_CATALOG) {
      expect(MODULE_LAYERS, `${m.id} has an unknown layer`).toContain(m.layer);
    }
    for (const layer of MODULE_LAYERS) {
      expect(modulesInLayer(layer).length, `layer ${layer} is empty`).toBeGreaterThan(0);
      expect(MODULE_LAYER_LABEL[layer]).toBeTruthy();
      expect(MODULE_LAYER_BLURB[layer]).toBeTruthy();
    }
  });

  it("is not trivially small — a catalogue of one would pass every other test here", () => {
    expect(MODULE_CATALOG.length).toBeGreaterThanOrEqual(12);
  });
});

describe("a REAL is a promise, so it must carry a receipt", () => {
  it("gives every REAL module evidence with something specific in it", () => {
    for (const m of MODULE_CATALOG.filter((x) => x.status === "real")) {
      expect(m.evidence, `${m.id} is marked REAL with no evidence`).toBeTruthy();
      // A one-word "yes" is not evidence. Force a sentence that a reader can check.
      expect(
        m.evidence.trim().length,
        `${m.id} is marked REAL but its evidence is too thin to check`,
      ).toBeGreaterThan(40);
    }
  });

  it("makes COMING modules explain themselves too, so nobody has to guess", () => {
    for (const m of MODULE_CATALOG.filter((x) => x.status === "coming")) {
      expect(m.evidence.trim().length, `${m.id} is COMING with no explanation`).toBeGreaterThan(40);
    }
  });

  it("only uses status values the page knows how to render", () => {
    for (const m of MODULE_CATALOG) {
      expect(["real", "coming"], `${m.id} has an unrenderable status`).toContain(m.status);
    }
  });
});

describe("entitlements point at licences that exist", () => {
  it("never invents a licence module id", () => {
    for (const m of MODULE_CATALOG) {
      if (m.entitlement === null) continue;
      expect(
        ENTITLEMENT_IDS as readonly string[],
        `${m.id} claims entitlement "${m.entitlement}", which is not a licence module that exists`,
      ).toContain(m.entitlement);
    }
  });

  it("keeps the known-id list matching what the live database actually carries", () => {
    // Read from organization_licenses.modules on 2026-09-14. If this list grows,
    // it should grow because the database did, not because a page wanted it to.
    expect([...ENTITLEMENT_IDS].sort()).toEqual([
      "agent_sales",
      "credit_repair",
      "dispatch_core",
      "lease_to_own",
      "operator_program",
      "partner_deploy",
      "rentals_app",
      "revenue_engine",
    ]);
  });
});

describe("the public voice", () => {
  // Internal names are for us. A customer reading one of these on a public page
  // learns something about how we talk about them, and none of it is good.
  const BANNED = [
    "hailmary",
    "aixmos box",
    "brainiac",
    "chummo",
    "moose",
    "justice league",
    "young justice",
    "watchtower",
    "cyborg",
    "rick",
    "sork",
  ];

  it("keeps internal codenames out of every customer-visible string", () => {
    for (const m of MODULE_CATALOG) {
      const visible = `${m.name} ${m.summary}`.toLowerCase();
      for (const word of BANNED) {
        expect(visible, `${m.id} shows the internal name "${word}" to a customer`).not.toContain(
          word,
        );
      }
    }
  });

  it("keeps names short enough to scan", () => {
    for (const m of MODULE_CATALOG) {
      expect(m.name.length, `${m.id} has a name too long to read in a card`).toBeLessThan(55);
      expect(m.summary.length, `${m.id} has a summary that has become a paragraph`).toBeLessThan(140);
    }
  });
});

describe("the two claims that got this catalogue written", () => {
  it("does not sell texting-your-assistant as live while it has never run", () => {
    const m = moduleById("text-your-assistant");
    expect(m, "the module was renamed or removed — re-check the claim before changing this test").toBeDefined();
    // Zero conversations and zero messages in the live database, and carrier
    // registration is incomplete. Flip this to REAL only when BOTH have changed.
    expect(
      m!.status,
      "text-your-assistant is the most sellable module and the most exposed claim. It stays COMING until it has carried real traffic AND carrier registration is done.",
    ).toBe("coming");
  });

  it("does not sell the phone assistant as live while it is switched off", () => {
    expect(moduleById("ai-receptionist")!.status).toBe("coming");
  });
});

describe("the query string is a stranger's input", () => {
  it("drops ids that are not in the catalogue instead of rendering them", () => {
    const picked = resolveSelection(["website-forms", "not-a-module", "<script>alert(1)</script>"]);
    expect(picked.map((m) => m.id)).toEqual(["website-forms"]);
  });

  it("drops duplicates so a repeated id cannot pad the selection", () => {
    const picked = resolveSelection(["booking", "booking", "booking"]);
    expect(picked).toHaveLength(1);
  });

  it("returns nothing for nothing", () => {
    expect(resolveSelection([])).toEqual([]);
  });
});

describe("a selection never flatters itself", () => {
  it("keeps COMING separate from REAL rather than reporting a single count", () => {
    const out = describeSelection(["website-forms", "text-your-assistant"]);
    expect(out.real.map((m) => m.id)).toEqual(["website-forms"]);
    expect(out.coming.map((m) => m.id)).toEqual(["text-your-assistant"]);
    expect(out.total).toBe(2);
  });

  it("counts a picked module exactly once, in exactly one bucket", () => {
    const ids = MODULE_CATALOG.map((m) => m.id);
    const out = describeSelection(ids);
    expect(out.real.length + out.coming.length).toBe(ids.length);
    const seen = [...out.real, ...out.coming].map((m) => m.id);
    expect(new Set(seen).size).toBe(ids.length);
  });

  // Positive control: if the catalogue somehow contained no COMING entries at
  // all, every test above about honest labelling would pass while saying
  // nothing. This asserts the split is real.
  it("actually contains both kinds, or the tests above are decorative", () => {
    expect(MODULE_CATALOG.some((m) => m.status === "real")).toBe(true);
    expect(MODULE_CATALOG.some((m) => m.status === "coming")).toBe(true);
  });
});
