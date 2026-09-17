import { describe, it, expect } from "vitest";
import { recordMetCheckpoints, loadCheckpointHistory } from "./checkpoint-events";
import { evaluateLadder, type LadderEvidence } from "./ladder";

const ALL_DONE: LadderEvidence = {
  goodStandingDays: 120,
  goodStanding: true,
  educationSectionsAcknowledged: 3,
  educationSectionsRequired: 3,
  creditEnrollmentActive: true,
  coreModulesComplete: 8,
  coreModulesTotal: 8,
  anyModuleStarted: true,
  mentorshipDfyActive: false,
  ltoAgreementSigned: false,
  vehicleTurnoverComplete: false,
  financingApproved: null,
};

const NOTHING: LadderEvidence = {
  goodStandingDays: null, goodStanding: null,
  educationSectionsAcknowledged: null, educationSectionsRequired: null,
  creditEnrollmentActive: null, coreModulesComplete: null, coreModulesTotal: null,
  anyModuleStarted: null, mentorshipDfyActive: null, ltoAgreementSigned: null,
  vehicleTurnoverComplete: null, financingApproved: null,
};

function db(errors: Array<{ code?: string; message: string } | null> = []) {
  const inserted: Record<string, unknown>[] = [];
  let i = 0;
  const client = {
    from: () => ({
      insert: (v: Record<string, unknown>) => {
        inserted.push(v);
        return Promise.resolve({ error: errors[i++] ?? null });
      },
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [{ checkpoint_slug: "a", met_at: "2026-09-01" }], error: null }) }),
      }),
    }),
  } as never;
  return { client, inserted };
}

describe("only real achievements are written", () => {
  it("records every met gate", async () => {
    const { client, inserted } = db();
    const r = await recordMetCheckpoints(client, "j1", evaluateLadder(ALL_DONE));
    expect(r.recorded).toContain("credit_education_acknowledged");
    expect(r.recorded).toContain("day_90_good_standing");
    expect(r.recorded).toContain("lto_eligible");
    expect(inserted.every(i => i.journey_id === "j1")).toBe(true);
  });

  it("writes NOTHING when nothing is met", async () => {
    // Every gate unknown. A milestone invented here is a fabricated step toward a car.
    const { client, inserted } = db();
    const r = await recordMetCheckpoints(client, "j1", evaluateLadder(NOTHING));
    expect(r.recorded).toEqual([]);
    expect(inserted).toHaveLength(0);
  });

  it("never records a gate that is merely not_met", async () => {
    const { client, inserted } = db();
    await recordMetCheckpoints(client, "j1", evaluateLadder({ ...ALL_DONE, coreModulesComplete: 3 }));
    const slugs = inserted.map(i => i.checkpoint_slug);
    expect(slugs).not.toContain("training_core_complete");
    expect(slugs).not.toContain("lto_eligible");
  });

  it("keeps the reason with the event, so the trail explains itself", async () => {
    const { client, inserted } = db();
    await recordMetCheckpoints(client, "j1", evaluateLadder(ALL_DONE));
    const ev = inserted.find(i => i.checkpoint_slug === "day_90_good_standing")!;
    expect((ev.evidence as { detail: string }).detail).toMatch(/120 consecutive days/);
  });
});

describe("safe to run on every page load", () => {
  it("a duplicate is already-known, not a failure", async () => {
    const { client } = db([{ code: "23505", message: "duplicate key" }]);
    const r = await recordMetCheckpoints(client, "j1", evaluateLadder(ALL_DONE));
    expect(r.alreadyKnown.length).toBeGreaterThan(0);
    expect(r.failed).toHaveLength(0);
  });

  it("a real failure is surfaced, never swallowed", async () => {
    // 23503: the code's ladder and the database's have drifted. Silently dropping it would
    // stop one step being recorded forever, with nothing to show for it.
    const { client } = db([{ code: "23503", message: "checkpoint_slug not present" }]);
    const r = await recordMetCheckpoints(client, "j1", evaluateLadder(ALL_DONE));
    expect(r.failed.length).toBe(1);
    expect(r.failed[0].error).toMatch(/not present/);
  });

  it("omits org_id entirely when none is given, so the column default applies", async () => {
    const { client, inserted } = db();
    await recordMetCheckpoints(client, "j1", evaluateLadder(ALL_DONE));
    expect(inserted[0]).not.toHaveProperty("org_id");
  });
});

describe("history is not rewritten when a gate stops being met", () => {
  it("a lapsed renter's past milestone is not deleted — nothing here deletes", async () => {
    const { client, inserted } = db();
    // Standing has lapsed, so day_90 is no longer met.
    await recordMetCheckpoints(client, "j1", evaluateLadder({ ...ALL_DONE, goodStanding: false }));
    // It simply is not re-recorded. No delete call exists on the client at all.
    expect(inserted.map(i => i.checkpoint_slug)).not.toContain("day_90_good_standing");
  });

  it("a read failure throws rather than showing an empty history", async () => {
    const bad = { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: "permission denied" } }) }) }) }) } as never;
    await expect(loadCheckpointHistory(bad, "j1")).rejects.toThrow(/permission denied/);
  });

  it("returns the history oldest first", async () => {
    const { client } = db();
    await expect(loadCheckpointHistory(client, "j1")).resolves.toEqual([
      { checkpoint_slug: "a", met_at: "2026-09-01" },
    ]);
  });
});
