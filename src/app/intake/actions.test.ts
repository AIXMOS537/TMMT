import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /intake is public and processUnifiedIntake writes with the service-role
 * client, which bypasses RLS. These tests pin the two things that matter on a
 * public write path: nothing is written unless the request earned it, and a
 * successful write actually reaches the thanks page.
 */
const h = vi.hoisted(() => ({
  limited: false,
  rateKeys: [] as string[],
  intakeCalls: [] as unknown[],
  intakeResult: { refCode: "TMMT-1234" } as { refCode: string },
  intakeThrows: null as Error | null,
}));

class Redirected extends Error {
  constructor(public url: string) {
    super("NEXT_REDIRECT");
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "203.0.113.9, 10.0.0.1"]]),
}));
vi.mock("@/lib/rate-limit-durable", () => ({
  isRateLimitedDurable: async (key: string) => {
    h.rateKeys.push(key);
    return h.limited;
  },
}));
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({ rpc: async () => ({ data: null, error: null }) }),
}));
vi.mock("@/lib/intake/unified", () => ({
  processUnifiedIntake: async (input: unknown) => {
    h.intakeCalls.push(input);
    if (h.intakeThrows) throw h.intakeThrows;
    return h.intakeResult;
  },
}));

import { submitIntakeAction } from "./actions";

function form(over: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    business_slug: "rentals",
    customer_name: "Ada Lovelace",
    customer_email: "ada@example.com",
    customer_phone: "[phone removed]",
    request_type: "rental_booking",
    subject: "Extend rental through Friday",
    details: "Model 3, return Sunday.",
    ...over,
  };
  for (const [k, v] of Object.entries(base)) if (v !== "") fd.set(k, v);
  return fd;
}

/** The action always ends by throwing NEXT_REDIRECT; hand back where it went. */
async function run(fd: FormData): Promise<string> {
  try {
    await submitIntakeAction(fd);
  } catch (e) {
    if (e instanceof Redirected) return e.url;
    throw e;
  }
  throw new Error("expected the action to redirect");
}

beforeEach(() => {
  h.limited = false;
  h.rateKeys.length = 0;
  h.intakeCalls.length = 0;
  h.intakeThrows = null;
});

describe("submitIntakeAction", () => {
  it("writes nothing when rate limited, and says so on the same form", async () => {
    h.limited = true;
    const url = await run(form());
    expect(h.intakeCalls).toHaveLength(0);
    expect(url).toContain("/intake/rentals?error=");
    expect(decodeURIComponent(url)).toContain("Too many submissions");
  });

  it("keys the rate limit on the client IP, not the proxy chain", async () => {
    await run(form());
    expect(h.rateKeys).toEqual(["intake:203.0.113.9"]);
  });

  it("writes once and lands on thanks with the reference", async () => {
    const url = await run(form());
    expect(h.intakeCalls).toHaveLength(1);
    expect(url).toBe("/intake/thanks?ref=TMMT-1234&business=rentals");
  });

  it("writes nothing when the payload fails validation", async () => {
    const url = await run(form({ customer_name: "", subject: "" }));
    expect(h.intakeCalls).toHaveLength(0);
    expect(url).toContain("/intake/rentals?error=");
  });

  it("writes nothing for an unknown business", async () => {
    const url = await run(form({ business_slug: "not-a-line" }));
    expect(h.intakeCalls).toHaveLength(0);
    expect(url).toContain("/intake?error=");
  });

  it("writes nothing for a request type that line does not offer", async () => {
    // "tow" is an auto-services type; the rentals line does not list it.
    const url = await run(form({ request_type: "tow" }));
    expect(h.intakeCalls).toHaveLength(0);
    expect(decodeURIComponent(url)).toContain("not available for this business");
  });

  it("surfaces a write failure on the form instead of a thanks page", async () => {
    h.intakeThrows = new Error("insert failed");
    const url = await run(form());
    expect(decodeURIComponent(url)).toContain("insert failed");
    expect(url).not.toContain("/thanks");
  });
});
