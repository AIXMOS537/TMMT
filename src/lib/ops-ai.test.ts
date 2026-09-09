import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ops-ai is a server module; the `server-only` marker throws outside a React
// server context, and the policy loader reads the filesystem.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ops-policy", () => ({ loadCompanyPolicyText: async () => "POLICY" }));

import { reviewOpsMessage } from "./ops-ai";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

const ctx = { audience: "executives", messageKind: "command", authorRole: "owner" };

/**
 * Remediation F-04. The old fallback returned { aligned: true, score: 0.5 }
 * whenever the AI never ran. The 0.75 threshold in ops-actions kept that from
 * publishing immediately, but `ai_aligned: true` was still written to the row
 * and publishOpsMessage trusts `ai_aligned` on its own — so a message the AI
 * never saw could be published as "AI reviewed". A review that did not happen
 * must say so.
 */
describe("reviewOpsMessage — a review that did not run is not a pass", () => {
  it("no API key: not aligned, score 0, reviewed=false, and no network call", async () => {
    const r = await reviewOpsMessage("hello team", ctx);
    expect(r.reviewed).toBe(false);
    expect(r.aligned).toBe(false);
    expect(r.score).toBe(0);
    expect(r.suggestedBody).toBe("hello team");
    expect(r.issues.join(" ")).toMatch(/not reviewed/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("provider error: not aligned, reviewed=false", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const r = await reviewOpsMessage("hello team", ctx);
    expect(r).toMatchObject({ reviewed: false, aligned: false, score: 0 });
  });

  it("unparseable model output: not aligned, reviewed=false", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "not json" }] }),
    });
    const r = await reviewOpsMessage("hello team", ctx);
    expect(r).toMatchObject({ reviewed: false, aligned: false, score: 0 });
  });

  it("a real review passes through with reviewed=true", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify({ aligned: true, score: 0.9, issues: [], suggestedBody: "hello team", summary: "ok" }) }],
      }),
    });
    const r = await reviewOpsMessage("hello team", ctx);
    expect(r).toMatchObject({ reviewed: true, aligned: true, score: 0.9 });
  });
});
