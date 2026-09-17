import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadLadderEvidence, type JourneyRow } from "./queries";
import { evaluateLadder } from "./ladder";

/**
 * A fake that models the one behaviour that matters: a table can be empty because the
 * feature is unwired, or empty for this renter while other renters have rows. Those two
 * must not produce the same verdict.
 */
function fakeDb(
  totals: Record<string, number>,
  mine: Record<string, number> = {},
  /** Latest financing_applications outcome for the journey, if any. */
  financingOutcome?: string,
) {
  return {
    from(table: string) {
      const chain = {
        _filtered: false,
        select() {
          return chain;
        },
        eq() {
          chain._filtered = true;
          return chain;
        },
        order() {
          return chain;
        },
        // financing_applications is read as ROWS, not a count.
        limit() {
          return Promise.resolve({
            data: financingOutcome ? [{ outcome: financingOutcome, applied_at: "2026-09-16" }] : [],
            error: null,
          });
        },
        then(resolve: (v: { count: number; error: null }) => void) {
          resolve({
            count: chain._filtered ? (mine[table] ?? 0) : (totals[table] ?? 0),
            error: null,
          });
        },
      };
      return chain;
    },
  } as never;
}

const JOURNEY: JourneyRow = {
  id: "j-1",
  good_standing: true,
  good_standing_days: 9,
  lto_eligible: false,
  program_track: "renter",
};

// Production as it actually stands: content seeded, nothing recording completion.
const PRODUCTION_TODAY = {
  credit_education_sections: 3,
  training_modules: 8,
  credit_education_acknowledgments: 0,
  credit_enrollments: 0,
  training_module_progress: 0,
  lto_agreements: 0,
};

beforeEach(() => vi.restoreAllMocks());

describe("an unwired source is unknown, not a failure", () => {
  it("reports null for every table nobody writes", async () => {
    const e = await loadLadderEvidence(fakeDb(PRODUCTION_TODAY), JOURNEY);
    expect(e.educationSectionsAcknowledged).toBeNull();
    expect(e.creditEnrollmentActive).toBeNull();
    expect(e.anyModuleStarted).toBeNull();
    expect(e.ltoAgreementSigned).toBeNull();
  });

  it("still reads the sources that ARE written", async () => {
    const e = await loadLadderEvidence(fakeDb(PRODUCTION_TODAY), JOURNEY);
    expect(e.goodStandingDays).toBe(9);
    expect(e.goodStanding).toBe(true);
    expect(e.educationSectionsRequired).toBe(3);
    expect(e.coreModulesTotal).toBe(8);
  });

  it("the ladder therefore blames nobody", async () => {
    const e = await loadLadderEvidence(fakeDb(PRODUCTION_TODAY), JOURNEY);
    const p = evaluateLadder(e);
    expect(p.gates.find(g => g.slug === "credit_education_acknowledged")!.state).toBe("unknown");
    expect(p.blockedByUnknown.length).toBeGreaterThan(0);
    expect(p.readyToSeekFinancing).toBe(false);
  });
});

describe("once a source IS wired, zero rows becomes a real answer", () => {
  it("other renters have rows but this one does not — that is not_met, not unknown", async () => {
    const e = await loadLadderEvidence(
      fakeDb({ ...PRODUCTION_TODAY, credit_enrollments: 12 }, { credit_enrollments: 0 }),
      JOURNEY,
    );
    expect(e.creditEnrollmentActive).toBe(false);
    expect(evaluateLadder(e).gates.find(g => g.slug === "credit_enrollment_active")!.state).toBe(
      "not_met",
    );
  });

  it("this renter's own rows are counted", async () => {
    const e = await loadLadderEvidence(
      fakeDb(
        { ...PRODUCTION_TODAY, credit_education_acknowledgments: 40 },
        { credit_education_acknowledgments: 3 },
      ),
      JOURNEY,
    );
    expect(e.educationSectionsAcknowledged).toBe(3);
    expect(evaluateLadder(e).gates.find(g => g.slug === "credit_education_acknowledged")!.state)
      .toBe("met");
  });
});

describe("an unseeded programme never counts as passed", () => {
  it("zero required sections is unknown, not an automatic clear", async () => {
    const e = await loadLadderEvidence(
      fakeDb({ ...PRODUCTION_TODAY, credit_education_sections: 0 }),
      JOURNEY,
    );
    expect(e.educationSectionsRequired).toBeNull();
  });
});

describe("an error is not an empty result", () => {
  it("a failed count throws instead of reporting the source unwired", async () => {
    const broken = {
      from() {
        const chain = {
          select: () => chain,
          eq: () => chain,
          then: (r: (v: { count: null; error: { message: string } }) => void) =>
            r({ count: null, error: { message: "permission denied" } }),
        };
        return chain;
      },
    } as never;
    await expect(loadLadderEvidence(broken, JOURNEY)).rejects.toThrow(/permission denied/);
  });
});

describe("the lender's verdict is read from financing_applications and nowhere else", () => {
  it("no application on file is pending, not a decline", async () => {
    const e = await loadLadderEvidence(fakeDb(PRODUCTION_TODAY), JOURNEY);
    expect(e.financingApproved).toBeNull();
    expect(evaluateLadder(e).financingDecision).toBe("pending");
  });

  it("a pending application is still pending", async () => {
    const e = await loadLadderEvidence(fakeDb(PRODUCTION_TODAY, {}, "pending"), JOURNEY);
    expect(e.financingApproved).toBeNull();
  });

  it("an approval is the ONLY thing that returns true", async () => {
    const e = await loadLadderEvidence(fakeDb(PRODUCTION_TODAY, {}, "approved"), JOURNEY);
    expect(e.financingApproved).toBe(true);
  });

  it.each(["declined", "withdrawn", "expired"])("%s is a recorded no", async outcome => {
    const e = await loadLadderEvidence(fakeDb(PRODUCTION_TODAY, {}, outcome), JOURNEY);
    expect(e.financingApproved).toBe(false);
  });

  it("internal progress can never produce an approval", async () => {
    // Every internal source fully satisfied, no application on file: still pending.
    const e = await loadLadderEvidence(
      fakeDb(
        { ...PRODUCTION_TODAY, credit_education_acknowledgments: 9, credit_enrollments: 9, training_module_progress: 9 },
        { credit_education_acknowledgments: 3, credit_enrollments: 1, training_module_progress: 8 },
      ),
      { ...JOURNEY, good_standing_days: 365 },
    );
    expect(e.financingApproved).toBeNull();
    expect(evaluateLadder(e).complete).toBe(false);
  });
});
