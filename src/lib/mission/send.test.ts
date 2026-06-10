import { describe, it, expect, vi } from "vitest";
import { fanOutMissionToChats } from "./fan-out";

describe("fanOutMissionToChats", () => {
  it("returns zero counts for an empty chatIds list without calling sendOne", async () => {
    const sendOne = vi.fn();
    const result = await fanOutMissionToChats([], "hello", sendOne);

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(sendOne).not.toHaveBeenCalled();
  });

  it("counts each true response as sent and each false as failed", async () => {
    const sendOne = vi
      .fn<(args: { chatId: string; text: string }) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await fanOutMissionToChats(["a", "b", "c"], "hi", sendOne);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
    expect(sendOne).toHaveBeenCalledTimes(3);
    expect(sendOne).toHaveBeenNthCalledWith(1, { chatId: "a", text: "hi" });
  });

  it("counts a thrown sendOne as failed without crashing the batch", async () => {
    const sendOne = vi
      .fn<(args: { chatId: string; text: string }) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(true);

    const result = await fanOutMissionToChats(["a", "b", "c"], "hi", sendOne);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("fans out concurrently — all sendOne calls fire before any resolve", async () => {
    let resolved = 0;
    const pending: Array<() => void> = [];
    const sendOne = vi.fn(async () => {
      return new Promise<boolean>((resolve) => {
        pending.push(() => {
          resolved++;
          resolve(true);
        });
      });
    });

    const out = fanOutMissionToChats(["a", "b", "c"], "hi", sendOne);

    await Promise.resolve();
    expect(sendOne).toHaveBeenCalledTimes(3);
    expect(resolved).toBe(0);

    pending.forEach((r) => r());
    const result = await out;
    expect(result.sent).toBe(3);
  });
});
