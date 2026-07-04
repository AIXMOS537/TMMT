import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runGuarded, tryGuarded } from "./guarded-agent";
import { engageHalt } from "./kill-switch";
import { verifyAuditChain } from "./audit-log";
import { HomeBrainHaltedError } from "./kill-switch";

let dir: string;
const env = () => ({
  halt: { killFile: path.join(dir, "HALT"), envHalted: false },
  ledger: { ledgerFile: path.join(dir, "spend.json"), now: new Date("2026-06-28T00:00:00Z") },
  audit: { auditDir: dir },
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "guarded-agent-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("runGuarded", () => {
  it("executes the action when all guards pass", async () => {
    let ran = false;
    const out = await runGuarded(
      { actor: "brainiac-mac/loop", action: "draft summary", costUsd: 0 },
      () => {
        ran = true;
        return "done";
      },
      env(),
    );
    expect(ran).toBe(true);
    expect(out.result).toBe("done");
    // Not just "ok" (an empty log is also ok) — assert an allowed entry was
    // actually written, so this fails if the guard were removed from runGuarded.
    const chain = verifyAuditChain(env().audit);
    expect(chain.ok).toBe(true);
    expect(chain.count).toBe(1);
  });

  it("does NOT execute when halted, and re-throws", async () => {
    engageHalt("owner stop", { killFile: path.join(dir, "HALT") });
    let ran = false;
    await expect(
      runGuarded(
        { actor: "brainiac-win/loop", action: "anything" },
        () => {
          ran = true;
        },
        env(),
      ),
    ).rejects.toBeInstanceOf(HomeBrainHaltedError);
    expect(ran).toBe(false);
  });
});

describe("tryGuarded", () => {
  it("returns a blockedReason instead of throwing", async () => {
    engageHalt("owner stop", { killFile: path.join(dir, "HALT") });
    let ran = false;
    const out = await tryGuarded(
      { actor: "brainiac-mac/loop", action: "send" },
      () => {
        ran = true;
      },
      env(),
    );
    expect(out.ran).toBe(false);
    expect(out.blockedReason).toMatch(/HALTED/);
    expect(ran).toBe(false);
  });
});
