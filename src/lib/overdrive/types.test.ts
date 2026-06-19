import { describe, it, expect } from "vitest";
import { BOARD_COLUMNS } from "./types";

describe("overdrive types", () => {
  it("board has the 9 expected columns in order", () => {
    expect(BOARD_COLUMNS).toEqual([
      "id", "status", "machine", "branch", "lane", "tier", "lease", "task", "log",
    ]);
  });
});
