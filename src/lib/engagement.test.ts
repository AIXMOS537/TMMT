import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { phaseSteps, type Engagement } from "@/lib/engagement";
import {
  CASE_STATUSES,
  ENGAGEMENT_PHASES,
  ENGAGEMENT_PHASE_FOR_CASE,
  ENGAGEMENT_PHASE_LABEL,
  ENGAGEMENT_PHASE_BLURB,
  engagementPhaseRank,
  type EngagementPhase,
} from "@/lib/workflow/statuses";

function engagement(over: Partial<Engagement> = {}): Engagement {
  return {
    id: "e1",
    organization_id: "11111111-1111-1111-1111-111111111111",
    phase: "build",
    intake_summary: {},
    whats_live: [],
    intake_at: "2026-09-01T00:00:00Z",
    agreement_at: "2026-09-03T00:00:00Z",
    build_at: "2026-09-05T00:00:00Z",
    live_at: null,
    ...over,
  };
}

describe("engagement phase vocabulary", () => {
  it("is exactly the four client-facing phases, in order", () => {
    expect(ENGAGEMENT_PHASES).toEqual(["intake", "agreement", "build", "live"]);
  });

  it("ranks phases by their position", () => {
    expect(engagementPhaseRank("intake")).toBe(0);
    expect(engagementPhaseRank("live")).toBe(3);
    expect(engagementPhaseRank("agreement")).toBeLessThan(engagementPhaseRank("build"));
  });

  it("labels and blurbs every phase — no phase renders blank", () => {
    for (const p of ENGAGEMENT_PHASES) {
      expect(ENGAGEMENT_PHASE_LABEL[p]?.length ?? 0).toBeGreaterThan(0);
      expect(ENGAGEMENT_PHASE_BLURB[p]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  // The point of this one: add a CaseStatus and forget the projection, and the
  // tracker would silently render an undefined phase for those clients.
  it("projects EVERY internal case status to a client phase", () => {
    for (const s of CASE_STATUSES) {
      const phase = ENGAGEMENT_PHASE_FOR_CASE[s];
      expect(ENGAGEMENT_PHASES).toContain(phase);
    }
    expect(Object.keys(ENGAGEMENT_PHASE_FOR_CASE).sort()).toEqual([...CASE_STATUSES].sort());
  });

  it("never shows a client an internal vendor state as a phase", () => {
    const phases = new Set<string>(ENGAGEMENT_PHASES);
    for (const s of ["vendor_needed", "vendor_assigned", "internal_quality_check"]) {
      expect(phases.has(s)).toBe(false);
    }
  });
});

describe("phaseSteps", () => {
  it("returns one step per phase, in order", () => {
    const steps = phaseSteps(engagement());
    expect(steps.map((s) => s.phase)).toEqual(["intake", "agreement", "build", "live"]);
  });

  it("marks earlier phases done, the current one current, later ones upcoming", () => {
    const steps = phaseSteps(engagement({ phase: "build" }));
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming"]);
  });

  // The honesty rule: the phase in progress is never painted as finished.
  it("does NOT mark the current phase done even though it has a timestamp", () => {
    const steps = phaseSteps(engagement({ phase: "build" }));
    const build = steps.find((s) => s.phase === "build")!;
    expect(build.at).toBe("2026-09-05T00:00:00Z");
    expect(build.state).toBe("current");
    expect(build.state).not.toBe("done");
  });

  it("carries a null timestamp for a phase that has not happened", () => {
    const steps = phaseSteps(engagement({ phase: "build" }));
    expect(steps.find((s) => s.phase === "live")!.at).toBeNull();
  });

  it("at intake, nothing is done", () => {
    const steps = phaseSteps(engagement({ phase: "intake" }));
    expect(steps.map((s) => s.state)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(steps.filter((s) => s.state === "done")).toHaveLength(0);
  });

  it("at live, everything before it is done and live is current", () => {
    const steps = phaseSteps(engagement({ phase: "live", live_at: "2026-09-09T00:00:00Z" }));
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
  });

  it("survives a phase whose timestamp was never backfilled", () => {
    const steps = phaseSteps(engagement({ phase: "live", agreement_at: null, live_at: null }));
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
    expect(steps.find((s) => s.phase === "agreement")!.at).toBeNull();
  });
});

describe("phase projection sanity", () => {
  const cases: Array<[string, EngagementPhase]> = [
    ["intake_submitted", "intake"],
    ["internal_review", "agreement"],
    ["vendor_in_progress", "build"],
    ["blocked", "build"],
    ["completed", "live"],
  ];
  it.each(cases)("%s reads to the client as %s", (status, expected) => {
    expect(ENGAGEMENT_PHASE_FOR_CASE[status as never]).toBe(expected);
  });
});

// Regression: the tracker rendered Aug 13 for a record stamped 2026-08-14.
// Phase timestamps are UTC midnight, so formatting them in a US local zone
// walks every date back a day. Caught by looking at the actual screenshot.
describe("phase dates do not drift a day west of Greenwich", () => {
  it("formats a UTC-midnight timestamp as that same calendar day", () => {
    const at = "2026-08-14T00:00:00Z";
    const local = new Date(at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const utc = new Date(at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(utc).toBe("Aug 14, 2026");
    // In any zone behind UTC the naive format is wrong; the point of the fix.
    if (new Date(at).getTimezoneOffset() > 0) expect(local).not.toBe(utc);
  });

  it("the view formats dates in UTC, not the viewer's zone", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/(pocket)/pocket/build/BuildTrackerView.tsx"),
      "utf8",
    );
    const fn = src.slice(src.indexOf("function when("));
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain('timeZone: "UTC"');
  });
});
