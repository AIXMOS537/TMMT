import { describe, it, expect } from "vitest";
import { isOpenVaTask, onlyOpenVaTasks } from "./va-task-lifecycle";

describe("va-task lifecycle — one definition of open", () => {
  it("open only when status is pending AND handled_at is null", () => {
    expect(isOpenVaTask({ status: "pending", handled_at: null })).toBe(true);
    expect(isOpenVaTask({ status: "pending" })).toBe(true);
    expect(isOpenVaTask({ status: "pending", handled_at: "2026-09-08T20:18:05Z" })).toBe(false);
    expect(isOpenVaTask({ status: "blocked_dnc", handled_at: null })).toBe(false);
    expect(isOpenVaTask({ status: "archived_legacy", handled_at: null })).toBe(false);
    expect(isOpenVaTask({ status: null, handled_at: null })).toBe(false);
  });

  it("applies both filters to a query", () => {
    const seen: Array<[string, string, unknown]> = [];
    const q = {
      eq(c: string, v: string) { seen.push(["eq", c, v]); return q; },
      is(c: string, v: null) { seen.push(["is", c, v]); return q; },
    };
    onlyOpenVaTasks(q);
    expect(seen).toEqual([["eq", "status", "pending"], ["is", "handled_at", null]]);
  });
});
