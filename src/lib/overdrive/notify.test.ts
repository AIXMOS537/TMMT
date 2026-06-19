import { describe, it, expect, vi } from "vitest";
import { formatNotification, sendImessage } from "./notify";
import type { BoardRow } from "./types";

const r: BoardRow = {
  id: 12, status: "DONE", machine: "rick", branch: "swarm/rick/12",
  lane: "code", tier: 1, lease: "", task: "fix login", log: "",
};

describe("formatNotification", () => {
  it("formats a success with engine + branch", () => {
    expect(formatNotification(r, "DONE", 1, 0.003)).toBe(
      "✅ #12 done by rick (Haiku ~$0.003) — fix login → swarm/rick/12",
    );
  });
  it("formats a failure that needs the owner", () => {
    expect(formatNotification({ ...r, status: "FAILED" }, "FAILED", -1, 0.05)).toBe(
      "❌ #12 FAILED (after Opus ~$0.05) — fix login — needs you",
    );
  });
});

describe("sendImessage", () => {
  it("POSTs the text to the relay", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true });
    await sendImessage("hi", "http://relay:8787", fakeFetch as unknown as typeof fetch);
    expect(fakeFetch).toHaveBeenCalledWith(
      "http://relay:8787/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("never throws when the relay is unreachable", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("down"));
    await expect(sendImessage("hi", "http://relay:8787", fakeFetch as unknown as typeof fetch)).resolves.toBeUndefined();
  });
});
