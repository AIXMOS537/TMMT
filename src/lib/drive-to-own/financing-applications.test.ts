import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordApplication,
  recordDecision,
  isDecision,
  FINANCING_OUTCOMES,
} from "./financing-applications";

const ROW = {
  id: "app-1",
  org_id: "org-1",
  journey_id: "j-1",
  lender_name: "Alpha Credit Union",
  applied_at: "2026-09-16",
  outcome: "pending",
  decided_at: null,
  decline_reason_category: null,
  notes: null,
};

let captured: Record<string, unknown> | null = null;
function db(result: { data: unknown; error: { message: string } | null }) {
  captured = null;
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    insert: (v: Record<string, unknown>) => {
      captured = v;
      return chain;
    },
    update: (v: Record<string, unknown>) => {
      captured = v;
      return chain;
    },
    eq: () => chain,
    select: () => chain,
    maybeSingle: () => Promise.resolve(result),
  });
  return { from: () => chain } as never;
}

beforeEach(() => {
  captured = null;
  vi.restoreAllMocks();
});

describe("an application always opens as pending", () => {
  it("never records an application as already decided", async () => {
    await recordApplication(db({ data: ROW, error: null }), {
      orgId: "org-1",
      journeyId: "j-1",
      lenderName: "Alpha Credit Union",
    });
    expect(captured).toMatchObject({ outcome: "pending" });
    expect(captured).not.toHaveProperty("decided_at");
  });

  it("requires a lender name, and never reaches the database without one", async () => {
    const r = await recordApplication(db({ data: ROW, error: null }), {
      orgId: "org-1",
      journeyId: "j-1",
      lenderName: "   ",
    });
    expect(r).toEqual({ ok: false, error: "A lender name is required." });
    expect(captured).toBeNull();
  });
});

describe("a decision without a date is refused before it reaches the database", () => {
  it.each(["approved", "declined", "withdrawn", "expired"] as const)(
    "%s with no decidedAt is refused",
    async outcome => {
      const r = await recordDecision(db({ data: ROW, error: null }), {
        applicationId: "app-1",
        outcome,
      });
      expect(r).toEqual({ ok: false, error: "A decision needs the date the lender made it." });
      expect(captured).toBeNull();
    },
  );

  it("pending needs no date and clears any date already set", async () => {
    await recordDecision(db({ data: ROW, error: null }), {
      applicationId: "app-1",
      outcome: "pending",
    });
    expect(captured).toMatchObject({ outcome: "pending", decided_at: null });
  });

  it("an unknown outcome never reaches the database", async () => {
    const r = await recordDecision(db({ data: ROW, error: null }), {
      applicationId: "app-1",
      // @ts-expect-error deliberately outside the taxonomy
      outcome: "definitely_approved",
      decidedAt: "2026-09-16",
    });
    expect(r.ok).toBe(false);
    expect(captured).toBeNull();
  });
});

describe("an approval cannot carry a decline reason", () => {
  it("refuses the contradiction rather than silently dropping it", async () => {
    const r = await recordDecision(db({ data: ROW, error: null }), {
      applicationId: "app-1",
      outcome: "approved",
      decidedAt: "2026-09-16",
      declineReasonCategory: "CREDIT_FINANCIAL",
    });
    expect(r).toEqual({ ok: false, error: "An approval cannot carry a decline reason." });
    expect(captured).toBeNull();
  });

  it("a decline keeps its reason", async () => {
    await recordDecision(db({ data: { ...ROW, outcome: "declined" }, error: null }), {
      applicationId: "app-1",
      outcome: "declined",
      decidedAt: "2026-09-16",
      declineReasonCategory: "CREDIT_FINANCIAL",
    });
    expect(captured).toMatchObject({ decline_reason_category: "CREDIT_FINANCIAL" });
  });

  it("a withdrawal carries no reason, even if one is passed", async () => {
    await recordDecision(db({ data: ROW, error: null }), {
      applicationId: "app-1",
      outcome: "withdrawn",
      decidedAt: "2026-09-16",
      declineReasonCategory: "CREDIT_FINANCIAL",
    });
    expect(captured).toMatchObject({ decline_reason_category: null });
  });
});

describe("the date recorded is the LENDER's, not the typist's", () => {
  it("uses the supplied decision date verbatim", async () => {
    await recordDecision(db({ data: ROW, error: null }), {
      applicationId: "app-1",
      outcome: "approved",
      decidedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(captured).toMatchObject({ decided_at: "2026-08-01T00:00:00.000Z" });
  });
});

describe("failures are reported, never swallowed", () => {
  it("a database error surfaces", async () => {
    const r = await recordApplication(db({ data: null, error: { message: "permission denied" } }), {
      orgId: "org-1",
      journeyId: "j-1",
      lenderName: "Alpha",
    });
    expect(r).toEqual({ ok: false, error: "permission denied" });
  });

  it("a missing row is not treated as success", async () => {
    const r = await recordDecision(db({ data: null, error: null }), {
      applicationId: "nope",
      outcome: "approved",
      decidedAt: "2026-09-16",
    });
    expect(r).toEqual({ ok: false, error: "That application could not be found." });
  });
});

describe("the outcome taxonomy matches the database check constraint", () => {
  it("lists exactly the five the migration allows", () => {
    expect([...FINANCING_OUTCOMES]).toEqual([
      "pending",
      "approved",
      "declined",
      "withdrawn",
      "expired",
    ]);
  });

  it("only pending is not a decision", () => {
    expect(isDecision("pending")).toBe(false);
    for (const o of FINANCING_OUTCOMES.filter(o => o !== "pending")) {
      expect(isDecision(o)).toBe(true);
    }
  });
});
