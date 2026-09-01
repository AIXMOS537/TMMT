import { describe, it, expect } from "vitest";
import { z } from "zod";
import { OrgIdSchema } from "./tenant";

/**
 * These tests exist to stop one specific outage coming back.
 *
 * Zod 4's .uuid() enforces the RFC 9562 version nibble. Three orgs were seeded with
 * repeated-letter placeholder ids, so on the day the dependency went 3 -> 4, every
 * lead posted for any of them started 500ing: PublicOrgRowSchema refused the row, and
 * the webhook route rethrows anything that is not OrgNotFoundError.
 *
 * The ids below were read off the live organizations table, not copied from the
 * commit that fixed this - that commit named only two of the three, and Moe Legacy
 * would have stayed broken with a green suite.
 *
 * The danger now is that the fix looks like clutter. Zod 4's own docs point you at
 * z.uuid(), so the hand-rolled regex reads as something worth tidying away - and
 * tidying it away is silent, because no fixture anywhere else uses a placeholder id.
 * The z.uuid() test below fails loudly if anyone tries.
 */

const TMMT = "8e651b25-e7c8-4356-af64-1716a82053b0";
const AIXMOS = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MOE_LEGACY = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OPERATION_OVERDRIVE = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const PLACEHOLDER_ORGS: [string, string][] = [
  ["AIXMOS", AIXMOS],
  ["Moe Legacy", MOE_LEGACY],
  ["Operation Overdrive", OPERATION_OVERDRIVE],
];

describe("OrgIdSchema", () => {
  it.each(PLACEHOLDER_ORGS)("accepts the seeded %s id, which the strict check rejected", (_name, id) => {
    expect(OrgIdSchema.safeParse(id).success).toBe(true);
  });

  it("still accepts a conventional v4 org id", () => {
    expect(OrgIdSchema.safeParse(TMMT).success).toBe(true);
  });

  it.each(PLACEHOLDER_ORGS)("is not interchangeable with z.uuid() for %s", (_name, id) => {
    // If these ever go green, the strict validator has started accepting the
    // placeholders and OrgIdSchema is free to go. Until then, swapping it back
    // reintroduces the outage.
    expect(z.string().uuid().safeParse(id).success).toBe(false);
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
