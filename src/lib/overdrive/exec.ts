import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Tier } from "./types";

const MODEL = { 1: "claude-haiku-4-5", 2: "claude-opus-4-8" } as const;
export const LOCAL_MODEL = "llama3.2:3b";

export interface TierCommand {
  bin: string;
  args: string[];
  cwd: string;
}

/** Pure: how to invoke a given tier with the task text, inside a working dir. */
export function buildTierCommand(tier: Tier, taskText: string, cwd: string): TierCommand {
  if (tier === 0) {
    return { bin: "ollama", args: ["run", LOCAL_MODEL], cwd };
  }
  return {
    bin: "claude",
    args: ["--model", MODEL[tier as 1 | 2], "--print", "--permission-mode", "acceptEdits", taskText],
    cwd,
  };
}

export interface RunResult {
  ok: boolean;
  output: string;
}

/** IO: run a tier to completion. Tier 0 pipes the task as stdin to the local model. */
export function runTier(
  tier: Tier,
  taskFile: string,
  cwd: string,
  timeoutMs = 20 * 60_000,
): Promise<RunResult> {
  const taskText = readFileSync(taskFile, "utf8");
  const cmd = buildTierCommand(tier, taskText, cwd);
  return new Promise((resolve) => {
    const child = spawn(cmd.bin, cmd.args, { cwd: cmd.cwd, env: process.env });
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    if (tier === 0) {
      child.stdin.write(taskText);
      child.stdin.end();
    }
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output: out });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, output: String(e) });
    });
  });
}
