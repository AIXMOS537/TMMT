import { describe, it, expect } from "vitest";
import { buildTierCommand } from "./exec";

describe("buildTierCommand", () => {
  it("tier 0 runs the local Ollama model", () => {
    const cmd = buildTierCommand(0, "do the task", "/wt");
    expect(cmd.bin).toBe("ollama");
    expect(cmd.args).toContain("llama3.2:3b");
  });
  it("tier 1 runs claude with the Haiku model id", () => {
    const cmd = buildTierCommand(1, "do the task", "/wt");
    expect(cmd.bin).toBe("claude");
    expect(cmd.args).toContain("claude-haiku-4-5");
  });
  it("tier 2 runs claude with the Opus model id", () => {
    const cmd = buildTierCommand(2, "do the task", "/wt");
    expect(cmd.bin).toBe("claude");
    expect(cmd.args).toContain("claude-opus-4-8");
  });
  it("claude tiers run inside the worktree cwd", () => {
    expect(buildTierCommand(2, "do the task", "/wt").cwd).toBe("/wt");
  });
  it("tier 1/2 pass the task text as the prompt arg", () => {
    expect(buildTierCommand(1, "fix the bug", "/wt").args).toContain("fix the bug");
  });
});
