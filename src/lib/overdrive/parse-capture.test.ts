import { describe, it, expect } from "vitest";
import { parseCapture } from "./parse-capture";

describe("parseCapture", () => {
  it("returns [] for empty input", async () => {
    expect(await parseCapture("   ", async () => "[]")).toEqual([]);
  });

  it("parses valid LLM JSON into coerced tasks", async () => {
    const llm = async () =>
      '[{"title":"fix the login bug","lane":"code","hint":"med","repo":"TMMT"}]';
    const tasks = await parseCapture("login is broken", llm);
    expect(tasks).toEqual([
      { title: "fix the login bug", lane: "code", hint: "med", repo: "TMMT" },
    ]);
  });

  it("coerces invalid lane/hint to safe defaults", async () => {
    const llm = async () => '[{"title":"x","lane":"weird","hint":"nope"}]';
    const tasks = await parseCapture("x", llm);
    expect(tasks[0]).toEqual({ title: "x", lane: "general", hint: "med", repo: null });
  });

  it("falls back to one general task when the LLM returns junk", async () => {
    const tasks = await parseCapture("buy milk and call Moe", async () => "not json");
    expect(tasks).toEqual([
      { title: "buy milk and call Moe", lane: "general", hint: "med", repo: null },
    ]);
  });

  it("falls back when the LLM throws (Ollama down)", async () => {
    const tasks = await parseCapture("do the thing", async () => {
      throw new Error("connection refused");
    });
    expect(tasks).toEqual([{ title: "do the thing", lane: "general", hint: "med", repo: null }]);
  });
});
