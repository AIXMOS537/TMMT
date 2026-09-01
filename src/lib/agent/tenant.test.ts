import { describe, it, expect } from "vitest";
import { z } from "zod";
import { OrgIdSchema } from "./tenant";

/**
 * These tests exist to stop one specific outage coming back.
 *
 * Zod 4's .uuid() enforces the RFC 9562 version nibble. AIXMOS was seeded with an
 * all-'a' placeholder id, so on the day the dependency went 3 -> 4, every lead posted
 * for that org started 500ing: PublicOrgRowSchema refused the row, and the webhook
 * route rethrows anything that is not OrgNotFoundError.
 *
 * The danger is that the fix looks like clutter. Zod 4's own docs point you at
 * z.uuid(), so the hand-rolled regex reads as something worth tidying away - and
 * tidying it away is silent, because no fixture anywhere else uses a placeholder id.
 * The third test below fails loudly if anyone tries.
 */

const TMMT = "8e651b25-e7c8-4356-af64-1716a82053b0";
const AIXMOS = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("OrgIdSchema", () => {
  it("accepts the seeded AIXMOS id, which is what the strict check rejected", () => {
    expect(OrgIdSchema.safeParse(AIXMOS).success).toBe(true);
  });

  it("still accepts a conventional v4 org id", () => {
    expect(OrgIdSchema.safeParse(TMMT).success).toBe(true);
  });

  it("is not interchangeable with z.uuid() - that is the whole point", () => {
    // If this ever goes green, the strict validator has started accepting the
    // placeholder and OrgIdSchema is free to go. Until then, swapping it back
    // reintroduces the outage.
    expect(z.string().uuid().safeParse(AIXMOS).success).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["not a uuid at all", "aixmos"],
    ["a group missing", "aaaaaaaa-aaaa-aaaa-aaaa"],
    ["a group the wrong length", "aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    ["non-hex characters", "gggggggg-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    ["padded with whitespace", ` ${AIXMOS} `],
    ["a trailing newline", `${AIXMOS}\n`],
    ["something appended", `${AIXMOS}-extra`],
  ])("rejects %s", (_label, value) => {
    expect(OrgIdSchema.safeParse(value).success).toBe(false);
  });
});
