// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import FinancingReadinessPanel from "./FinancingReadinessPanel";
import { assessFinancingReadiness } from "@/lib/drive-to-own/financing-readiness";
import { findBannedPhrases } from "@/lib/agent/compliance/banned-phrases";
import type { CreditProfile, NegativeItem } from "@/lib/credit-dispute/types";

afterEach(cleanup);

const profile = (e: number, q: number, t: number) =>
  ({ id: "p", fullName: "R", scoreExperian: e, scoreEquifax: q, scoreTransunion: t }) as CreditProfile;
const repo = () =>
  ({ id: "i", itemType: "repossession", furnisherName: "X", currentRound: 1, status: "active" }) as
    unknown as NegativeItem;

const NO_RENTAL = { goodStandingDays: null, goodStanding: null, paymentsFurnished: null };
const GOOD = { goodStandingDays: 120, goodStanding: true, paymentsFurnished: true };

describe("the panel never promises an approval", () => {
  it("the strongest possible file still defers to the lender", () => {
    render(
      <FinancingReadinessPanel
        readiness={assessFinancingReadiness(profile(800, 800, 800), [], GOOD)}
      />,
    );
    expect(screen.getByText(/strong position to apply/i)).toBeDefined();
    expect(screen.queryByText(/you are approved|guaranteed/i)).toBeNull();
    expect(screen.getByText(/approval is always up to the lender/i)).toBeDefined();
  });

  it("no rendered text trips the banned-phrase gate, in any stage", () => {
    const cases = [
      assessFinancingReadiness(null, null, NO_RENTAL),
      assessFinancingReadiness(profile(450, 460, 470), [repo()], {
        goodStandingDays: 5,
        goodStanding: true,
        paymentsFurnished: false,
      }),
      assessFinancingReadiness(profile(800, 800, 800), [], GOOD),
    ];
    for (const r of cases) {
      const { container, unmount } = render(<FinancingReadinessPanel readiness={r} />);
      const text = container.textContent ?? "";
      expect(findBannedPhrases(text), text.slice(0, 200)).toHaveLength(0);
      unmount();
    }
  });
});

describe("a renter with no report is invited, not judged", () => {
  it("shows the invitation and no score", () => {
    render(
      <FinancingReadinessPanel readiness={assessFinancingReadiness(null, null, NO_RENTAL)} />,
    );
    expect(screen.getByText(/let's see where you stand/i)).toBeDefined();
    expect(screen.getByText(/nothing here affects your rental/i)).toBeDefined();
  });

  it("counts no failed checks when nothing has been checked", () => {
    render(
      <FinancingReadinessPanel readiness={assessFinancingReadiness(null, null, NO_RENTAL)} />,
    );
    // "X of Y checks looking good" must not appear when every factor is unknown.
    expect(screen.queryByText(/checks looking good/i)).toBeNull();
  });
});

describe("it shows the renter their own rental record", () => {
  it("surfaces the TMMT payment history as a factor", () => {
    render(
      <FinancingReadinessPanel
        readiness={assessFinancingReadiness(profile(700, 700, 700), [], GOOD)}
      />,
    );
    expect(screen.getByText(/your rental payment record/i)).toBeDefined();
    expect(screen.getByText(/120 days of on-time payments/i)).toBeDefined();
  });

  it("shows the lowest bureau score, not an average", () => {
    render(
      <FinancingReadinessPanel
        readiness={assessFinancingReadiness(profile(800, 800, 520), [], GOOD)}
      />,
    );
    expect(screen.getByText("520")).toBeDefined();
  });
});
