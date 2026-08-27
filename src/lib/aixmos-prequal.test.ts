import { describe, it, expect } from "vitest";
import { decidePrequalRoute, handoffArgs, PREQUAL_GHL_TAGS } from "./aixmos-prequal";

/**
 * The status strings below are the real values in background_checks
 * .eligibility_status, counts as of 2026-08-26:
 *   Eligible 81 · Need Manager's Review 69 · null 67
 *   out of radius 49 · Not Eligible 24 · Not found 9
 */

describe("decidePrequalRoute", () => {
  it("leaves eligible applicants alone — the post-rental lane owns them", () => {
    expect(decidePrequalRoute("Eligible").action).toBe("none");
    expect(decidePrequalRoute("Eligible").ghlTag).toBeNull();
  });

  it("routes a profile decline to AIXMOS", () => {
    const d = decidePrequalRoute("Not Eligible");
    expect(d.action).toBe("handoff_to_aixmos");
    expect(d.ghlTag).toBe(PREQUAL_GHL_TAGS.prequal);
    expect(d.reason).toMatch(/credit and funding/i);
  });

  it("does NOT route an out-of-radius applicant to credit guidance", () => {
    const d = decidePrequalRoute("out of radius");
    expect(d.action).toBe("market_waitlist");
    expect(d.ghlTag).toBe(PREQUAL_GHL_TAGS.outOfArea);
    expect(d.requiresConsent).toBeNull();
  });

  it("waits for the human when a manager still has to decide", () => {
    // Apostrophe variants included: this column is typed by hand.
    for (const s of ["Need Manager's Review", "Need Manager’s Review", "needs review"]) {
      expect(decidePrequalRoute(s).action).toBe("await_review");
      expect(decidePrequalRoute(s).ghlTag).toBeNull();
    }
  });

  it("treats 'Not found' as a failed check, not a decision about the person", () => {
    const d = decidePrequalRoute("Not found");
    expect(d.action).toBe("await_review");
    expect(d.reason).toMatch(/re-run/i);
  });

  it("does nothing for a blank or missing status", () => {
    for (const s of [null, undefined, "", "   "]) {
      expect(decidePrequalRoute(s).action).toBe("none");
    }
  });

  it("is case and whitespace insensitive", () => {
    expect(decidePrequalRoute("  NOT ELIGIBLE  ").action).toBe("handoff_to_aixmos");
    expect(decidePrequalRoute("Out Of Radius").action).toBe("market_waitlist");
  });

  it("only ever demands consent for the cross-company handoff", () => {
    expect(decidePrequalRoute("Not Eligible").requiresConsent).toBe("sms");
    expect(decidePrequalRoute("out of radius").requiresConsent).toBeNull();
    expect(decidePrequalRoute("Eligible").requiresConsent).toBeNull();
  });
});

describe("handoffArgs", () => {
  const declined = decidePrequalRoute("Not Eligible");

  it("builds the RPC arguments when consent was captured", () => {
    const args = handoffArgs({
      decision: declined,
      contactRef: "+15555550100",
      consentCapturedVia: "sms",
    });
    expect(args).not.toBeNull();
    // The slugs partner_referrals CHECKs against, not organizations.name.
    expect(args!.p_source_org).toBe("tmmt");
    expect(args!.p_dest_org).toBe("aixmos");
    expect(args!.p_consent_channel).toBe("sms");
    expect(args!.p_commission_cents).toBe(0);
    expect(args!.p_reason).toBe(declined.reason);
  });

  it("refuses to hand anyone over without consent", () => {
    expect(
      handoffArgs({ decision: declined, contactRef: "+15555550100", consentCapturedVia: null })
    ).toBeNull();
  });

  it("refuses when the decision was not a handoff", () => {
    const waitlisted = decidePrequalRoute("out of radius");
    expect(
      handoffArgs({ decision: waitlisted, contactRef: "+15555550100", consentCapturedVia: "sms" })
    ).toBeNull();
  });

  it("refuses without a contact to hand over", () => {
    expect(
      handoffArgs({ decision: declined, contactRef: "   ", consentCapturedVia: "sms" })
    ).toBeNull();
  });

  it("trims the contact reference", () => {
    const args = handoffArgs({
      decision: declined,
      contactRef: "  +15555550100 ",
      consentCapturedVia: "email",
    });
    expect(args!.p_contact_ref).toBe("+15555550100");
  });
});
