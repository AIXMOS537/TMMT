import { describe, it, expect } from "vitest";
import {
  parseBoard, serializeBoard, nextId, tierForHint, addTask, claim, mark, BOARD_HEADER,
} from "./board";
import type { BoardRow } from "./types";

const sample: BoardRow[] = [
  { id: 1, status: "DONE", machine: "rick", branch: "swarm/rick/1", lane: "code", tier: 1, lease: "", task: "do a thing", log: "haiku ok" },
  { id: 2, status: "TODO", machine: "", branch: "", lane: "general", tier: 0, lease: "", task: "draft a note", log: "" },
];

describe("board", () => {
  it("round-trips parse(serialize(rows))", () => {
    const tsv = serializeBoard(sample);
    expect(tsv.startsWith(BOARD_HEADER)).toBe(true);
    expect(parseBoard(tsv)).toEqual(sample);
  });

  it("parse ignores blank lines and the header", () => {
    const tsv = `${BOARD_HEADER}\n\n1\tTODO\t\t\tgeneral\t0\t\thello\t\n`;
    const rows = parseBoard(tsv);
    expect(rows).toHaveLength(1);
    expect(rows[0].task).toBe("hello");
  });

  it("nextId returns max+1, or 1 when empty", () => {
    expect(nextId(sample)).toBe(3);
    expect(nextId([])).toBe(1);
  });

  it("tierForHint maps easy/med/hard to 0/1/2", () => {
    expect(tierForHint("easy")).toBe(0);
    expect(tierForHint("med")).toBe(1);
    expect(tierForHint("hard")).toBe(2);
  });

  it("addTask appends a TODO row with tier from hint", () => {
    const rows = addTask([], { title: "ship it", lane: "code", hint: "hard", repo: "TMMT" });
    expect(rows[0]).toMatchObject({ id: 1, status: "TODO", lane: "code", tier: 2, task: "ship it" });
  });

  it("claim sets machine, branch, lease and CLAIMED", () => {
    const rows = claim(addTask([], { title: "x", lane: "general", hint: "easy", repo: null }), 1, "rick", "2026-06-18T00:30:00Z");
    expect(rows[0]).toMatchObject({ status: "CLAIMED", machine: "rick", branch: "swarm/rick/1", lease: "2026-06-18T00:30:00Z" });
  });

  it("mark updates status and merges a patch", () => {
    const rows = mark(sample, 2, "FAILED", { log: "opus failed" });
    expect(rows.find((r) => r.id === 2)).toMatchObject({ status: "FAILED", log: "opus failed" });
  });
});
