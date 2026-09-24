import { describe, it, expect } from "vitest";
import {
  REQUIRED_DISCLOSURES,
  canBeginWork,
  canCollectFee,
  cancellationDeadline,
  engagementStatus,
  isWithinCancellationWindow,
  type EngagementState,
} from "./croa-gate";

const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/** A fully compliant engagement, signed far enough back to be billable. */
function goodState(over: Partial<EngagementState> = {}): EngagementState {
  const signed = daysAgo(30);
  const rights = new Date(signed.getTime() - 86400000); // the day before
  return {
    acknowledged: {
      consumer_credit_file_rights: iso(rights),
      written_contract: iso(signed),
      right_to_cancel: iso(signed),
    },
    contractSignedAt: iso(signed),
    servicesPerformed: [
      { description: "Round 1 disputes sent to all three bureaus", completedAt: iso(daysAgo(20)) },
    ],
    ...over,
  };
}

describe("what CROA requires is named, not invented", () => {
  it("lists all three requirements", () => {
    expect(REQUIRED_DISCLOSURES).toHaveLength(3);
    expect(REQUIRED_DISCLOSURES.map((d) => d.id)).toEqual([
      "consumer_credit_file_rights",
      "written_contract",
      "right_to_cancel",
    ]);
  });

  it("marks the disclosure text as still needing counsel rather than asserting it", () => {
    for (const d of REQUIRED_DISCLOSURES) {
      expect(d.note).toMatch(/\[OPEN\]/);
    }
  });

  it("requires the rights statement before the contract", () => {
    const rights = REQUIRED_DISCLOSURES.find((d) => d.id === "consumer_credit_file_rights");
    expect(rights?.beforeContract).toBe(true);
  });
});

describe("work cannot begin without the paperwork", () => {
  it("blocks when nothing has been acknowledged", () => {
    const r = canBeginWork({ acknowledged: {}, servicesPerformed: [] });
    expect(r.allowed).toBe(false);
    expect(r.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it("blocks when the contract is unsigned", () => {
    const s = goodState();
    delete s.contractSignedAt;
    const r = canBeginWork(s);
    expect(r.allowed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/contract not signed/i);
  });

  it("blocks when the rights statement came AFTER the contract", () => {
    const signed = daysAgo(10);
    const r = canBeginWork({
      acknowledged: {
        consumer_credit_file_rights: iso(daysAgo(9)), // a day later
        written_contract: iso(signed),
        right_to_cancel: iso(signed),
      },
      contractSignedAt: iso(signed),
      servicesPerformed: [],
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/must come before/i);
  });

  it("blocks a cancelled engagement", () => {
    const r = canBeginWork(goodState({ cancelledAt: iso(daysAgo(1)) }));
    expect(r.allowed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/cancelled/i);
  });

  it("allows when everything is in order", () => {
    expect(canBeginWork(goodState()).allowed).toBe(true);
  });
});

describe("the no-advance-fee rule", () => {
  it("REFUSES to bill when no services have been performed", () => {
    const r = canCollectFee(goodState({ servicesPerformed: [] }));
    expect(r.allowed).toBe(false);
    expect(r.ruleId).toBe("croa-no-advance-fee");
    expect(r.blockers.join(" ")).toMatch(/no services have been performed/i);
  });

  it("REFUSES to bill inside the cancellation window, even with work done", () => {
    const signed = new Date(); // today
    const rights = new Date(signed.getTime() - 1000);
    const r = canCollectFee({
      acknowledged: {
        consumer_credit_file_rights: iso(rights),
        written_contract: iso(signed),
        right_to_cancel: iso(signed),
      },
      contractSignedAt: iso(signed),
      servicesPerformed: [{ description: "letters sent", completedAt: iso(signed) }],
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/cancellation window/i);
  });

  it("allows billing once work is done and the window has closed", () => {
    expect(canCollectFee(goodState()).allowed).toBe(true);
  });

  it("will not bill an engagement that never properly began", () => {
    const r = canCollectFee({
      acknowledged: {},
      servicesPerformed: [{ description: "something", completedAt: iso(daysAgo(1)) }],
    });
    expect(r.allowed).toBe(false);
    expect(r.ruleId).toBe("croa-billing-preconditions");
  });

  it("a signed contract alone is never enough to bill", () => {
    // The exact pattern the company's own documents name as the violation:
    // paperwork done, membership billed, no work performed yet.
    const signed = daysAgo(30);
    const r = canCollectFee({
      acknowledged: {
        consumer_credit_file_rights: iso(daysAgo(31)),
        written_contract: iso(signed),
        right_to_cancel: iso(signed),
      },
      contractSignedAt: iso(signed),
      servicesPerformed: [],
    });
    expect(r.allowed).toBe(false);
  });
});

describe("the cancellation window", () => {
  it("counts three BUSINESS days, skipping the weekend", () => {
    // Thursday -> Friday, Monday, Tuesday
    const thursday = new Date("2026-09-03T10:00:00Z"); // a Thursday
    const deadline = cancellationDeadline(thursday);
    expect(deadline.getDay()).toBe(2); // Tuesday
  });

  it("is open on the day of signing", () => {
    expect(isWithinCancellationWindow(new Date())).toBe(true);
  });

  it("is closed a month later", () => {
    expect(isWithinCancellationWindow(daysAgo(30))).toBe(false);
  });

  it("errs toward giving the consumer more time, never less", () => {
    // Counting only weekends (no holiday calendar) can only push the real
    // deadline later, never earlier — which is the safe direction.
    const signed = new Date("2026-09-03T10:00:00Z");
    const deadline = cancellationDeadline(signed);
    const naiveThreeDays = new Date(signed.getTime() + 3 * 86400000);
    expect(deadline.getTime()).toBeGreaterThanOrEqual(naiveThreeDays.getTime() - 86400000);
  });
});

describe("desk status", () => {
  it("leads with cancellation when the consumer cancelled", () => {
    expect(engagementStatus(goodState({ cancelledAt: iso(daysAgo(1)) }))).toMatch(/cancelled/i);
  });

  it("says not started when the paperwork is missing", () => {
    expect(engagementStatus({ acknowledged: {}, servicesPerformed: [] })).toMatch(/not started/i);
  });

  it("distinguishes may-work from may-bill", () => {
    const s = goodState({ servicesPerformed: [] });
    expect(engagementStatus(s)).toMatch(/work may proceed/i);
    expect(engagementStatus(s)).toMatch(/not yet billable/i);
  });

  it("says cleared to bill when it is", () => {
    expect(engagementStatus(goodState())).toBe("Cleared to bill");
  });
});
