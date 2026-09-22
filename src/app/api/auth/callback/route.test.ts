import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * C3-003 — the auth callback never sends a user off-site, whatever `next` holds.
 * The code exchange is stubbed to SUCCEED, because that is the only path on which
 * `next` is used (a real attack needs a victim's valid PKCE code).
 */
const state = vi.hoisted(() => ({ exchangeError: null as null | { message: string } }));
vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: state.exchangeError }) } }),
}));

import { GET } from "./route";
import { safeRelativePath } from "@/lib/safe-redirect";

const ORIGIN = "https://tmmt-ops.vercel.app";

async function go(next: string | null, code: string | null = "pkce-code") {
  const u = new URL(`${ORIGIN}/api/auth/callback`);
  if (code !== null) u.searchParams.set("code", code);
  if (next !== null) u.searchParams.set("next", next);
  const res = await GET(new NextRequest(u));
  return new URL(res.headers.get("location")!);
}

// Values as they arrive AFTER one round of percent-decoding by searchParams.
const HOSTILE = [
  "https://evil.com",
  "http://evil.com/login/reset",
  "//evil.com",
  "///evil.com",
  "/\\evil.com", // the escape the old check missed
  "\\\\evil.com",
  "/\\/evil.com",
  "/\t/evil.com", // tab stripped by the URL parser → //evil.com
  "/\n/evil.com",
  "/\r/evil.com",
  "/%2F%2Fevil.com", // double-encoded; must stay a same-origin path
  "%2F%2Fevil.com",
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "https:evil.com",
  "http://tmmt-ops.vercel.app.evil.com",
  "https://tmmt-ops.vercel.app@evil.com",
  "/login?next=https://evil.com", // nested: harmless (nothing reads it) and stays on-site
  " /evil",
  "",
  "x".repeat(600),
];

beforeEach(() => {
  state.exchangeError = null;
});

describe("auth callback redirect target", () => {
  it.each(HOSTILE)("never leaves the site for next=%j", async (next) => {
    const loc = await go(next);
    expect(loc.origin).toBe(ORIGIN);
  });

  it("the two known escapes fall back to the reset page", async () => {
    expect((await go("/\\evil.com")).pathname).toBe("/login/reset");
    expect((await go("/\t/evil.com")).pathname).toBe("/login/reset");
  });

  it("keeps a legitimate same-app path, query included", async () => {
    const loc = await go("/login/reset?from=email");
    expect(loc.pathname).toBe("/login/reset");
    expect(loc.search).toBe("?from=email");
  });

  it("no code → invalid link; failed exchange → expired link; neither uses next", async () => {
    expect((await go("https://evil.com", null)).pathname + (await go("https://evil.com", null)).search).toBe("/login?error=invalid_link");
    state.exchangeError = { message: "bad code" };
    const loc = await go("/\\evil.com");
    expect(loc.origin).toBe(ORIGIN);
    expect(loc.search).toBe("?error=expired_link");
  });
});

describe("safeRelativePath", () => {
  it.each(HOSTILE)("rejects or neutralises %j", (v) => {
    const out = safeRelativePath(v, "/fallback");
    expect(out.startsWith("/")).toBe(true);
    expect(out.startsWith("//")).toBe(false);
    expect(new URL(out, ORIGIN).origin).toBe(ORIGIN);
  });
  it("refuses control characters and backslashes even when the result would stay on-site", () => {
    // The URL parser would quietly turn these into "/login/reset" and "/a/b"; a value
    // that has to be rewritten to look safe is refused instead.
    expect(safeRelativePath("/login/re\tset", "/fallback")).toBe("/fallback");
    expect(safeRelativePath("/a\\b", "/fallback")).toBe("/fallback");
    expect(safeRelativePath(`/ok${String.fromCharCode(127)}`, "/fallback")).toBe("/fallback");
  });
  it("returns the fallback for non-strings", () => {
    expect(safeRelativePath(null, "/f")).toBe("/f");
    expect(safeRelativePath(undefined, "/f")).toBe("/f");
    expect(safeRelativePath(42 as unknown as string, "/f")).toBe("/f");
  });
});
