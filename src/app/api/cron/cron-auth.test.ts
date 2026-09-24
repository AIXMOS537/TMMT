/**
 * The middleware lets /api/cron/* through without a session (Vercel Cron has none), so these
 * routes MUST authenticate themselves. Proves they fail closed: no secret configured, no header,
 * or a wrong bearer all return 401 and never touch the job code.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const recomputeAll = vi.fn();
vi.mock("@/lib/client-journey/recompute", () => ({
  recomputeAllActiveJourneys: recomputeAll,
  recomputeJourneyForEmail: vi.fn(),
}));

const URL_ = "https://tmmt-ops.vercel.app/api/cron/journey-recompute";

describe("cron routes authenticate themselves (fail closed)", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    recomputeAll.mockReset();
    recomputeAll.mockResolvedValue({ processed: 0 });
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("401 when no secret is configured, even with a bearer", async () => {
    delete process.env.CRON_SECRET;
    delete process.env.OPS_COMMAND_SECRET;
    const { GET } = await import("./journey-recompute/route");
    const res = await GET(new Request(URL_, { headers: { authorization: "Bearer anything" } }));
    expect(res.status).toBe(401);
    expect(recomputeAll).not.toHaveBeenCalled();
  });

  it("401 with no authorization header", async () => {
    process.env.CRON_SECRET = "test-cron-secret-123";
    const { GET } = await import("./journey-recompute/route");
    const res = await GET(new Request(URL_));
    expect(res.status).toBe(401);
    expect(recomputeAll).not.toHaveBeenCalled();
  });

  it("401 with a wrong bearer", async () => {
    process.env.CRON_SECRET = "test-cron-secret-123";
    const { GET } = await import("./journey-recompute/route");
    const res = await GET(new Request(URL_, { headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(401);
    expect(recomputeAll).not.toHaveBeenCalled();
  });

  it("runs the job with the correct bearer (what Vercel Cron sends)", async () => {
    process.env.CRON_SECRET = "test-cron-secret-123";
    const { GET } = await import("./journey-recompute/route");
    const res = await GET(new Request(URL_, { headers: { authorization: "Bearer test-cron-secret-123" } }));
    expect(res.status).toBe(200);
    expect(recomputeAll).toHaveBeenCalledTimes(1);
  });
});
