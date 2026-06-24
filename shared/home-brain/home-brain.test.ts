import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assertNotHalted,
  isHalted,
  engageHalt,
  releaseHalt,
  HomeBrainHaltedError,
} from "./kill-switch";
import {
  spentToday,
  recordSpend,
  assertUnderCap,
  SpendCapExceededError,
} from "./spend-ledger";
import {
  scanForPii,
  assertLocalOnlyForPII,
  PiiFirewallError,
} from "./pii-firewall";
import { appendAudit, verifyAuditChain } from "./audit-log";
import { guardHomeAction, HomeApprovalRequiredError } from "./home-guard";
import {
  createPendingAction,
  type GatedAction,
} from "../owner-approval-gate/approval";

let dir: string;
const killFile = () => path.join(dir, "HALT");
const ledgerFile = () => path.join(dir, "spend.json");
const audit = () => ({ auditDir: dir });
const FIXED = new Date("2026-06-24T12:00:00.000Z");

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "home-brain-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("kill switch", () => {
  it("is clear by default and halts once the sentinel file exists", () => {
    expect(isHalted({ killFile: killFile(), envHalted: false })).toBe(false);
    engageHalt("owner pressed stop", { killFile: killFile() });
    expect(isHalted({ killFile: killFile(), envHalted: false })).toBe(true);
    expect(() =>
      assertNotHalted({ killFile: killFile(), envHalted: false }),
    ).toThrow(HomeBrainHaltedError);
    releaseHalt({ killFile: killFile() });
    expect(isHalted({ killFile: killFile(), envHalted: false })).toBe(false);
  });

  it("halts on the env flag regardless of file", () => {
    expect(isHalted({ killFile: killFile(), envHalted: true })).toBe(true);
  });
});

describe("spend ledger", () => {
  it("accumulates and caps daily spend", () => {
    const opts = { ledgerFile: ledgerFile(), now: FIXED };
    expect(spentToday(opts)).toBe(0);
    recordSpend(2.5, opts);
    recordSpend(1.25, opts);
    expect(spentToday(opts)).toBeCloseTo(3.75);
    expect(() => assertUnderCap(10, 1, opts)).not.toThrow();
    expect(() => assertUnderCap(4, 1, opts)).toThrow(SpendCapExceededError);
  });

  it("treats a non-positive cap as no local cap", () => {
    const opts = { ledgerFile: ledgerFile(), now: FIXED };
    recordSpend(999, opts);
    expect(() => assertUnderCap(0, 100, opts)).not.toThrow();
  });
});

describe("PII firewall", () => {
  it("detects common PII kinds", () => {
    expect(scanForPii("ssn 123-45-6789").kinds).toContain("ssn");
    expect(scanForPii("reach me at a.b@example.com").kinds).toContain("email");
    expect(scanForPii("call 555-123-4567").kinds).toContain("phone");
    expect(scanForPii("123 Main Street").kinds).toContain("street_address");
  });

  it("blocks PII to cloud but allows local, and allows clean cloud sends", () => {
    expect(() => assertLocalOnlyForPII("ssn 123-45-6789", "cloud")).toThrow(
      PiiFirewallError,
    );
    expect(() => assertLocalOnlyForPII("ssn 123-45-6789", "local")).not.toThrow();
    expect(() =>
      assertLocalOnlyForPII("what is the fleet utilization?", "cloud"),
    ).not.toThrow();
  });
});

describe("audit chain", () => {
  it("hash-chains entries and verifies clean", () => {
    appendAudit({ actor: "brainiac-mac", action: "draft reply" }, audit());
    appendAudit({ actor: "brainiac-win", action: "analyze fleet" }, audit());
    const res = verifyAuditChain(audit());
    expect(res.ok).toBe(true);
    expect(res.count).toBe(2);
  });

  it("detects tampering with history", () => {
    appendAudit({ actor: "brainiac-mac", action: "draft reply" }, audit());
    appendAudit({ actor: "brainiac-mac", action: "charge fee" }, audit());
    const file = path.join(dir, "home-brain-audit.jsonl");
    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    const first = JSON.parse(lines[0]);
    first.action = "draft innocuous note"; // rewrite history, keep the hash
    lines[0] = JSON.stringify(first);
    fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
    const res = verifyAuditChain(audit());
    expect(res.ok).toBe(false);
    expect(res.brokenAtSeq).toBe(0);
  });
});

describe("guardHomeAction (unified chokepoint)", () => {
  const env = () => ({
    halt: { killFile: killFile(), envHalted: false },
    ledger: { ledgerFile: ledgerFile(), now: FIXED },
    audit: audit(),
  });
  const approved: GatedAction = {
    ...createPendingAction("customer_message", { to: "+15551001001" }, "owner"),
    status: "approved",
    approvedBy: "owner",
  };

  it("allows a safe local drafting action and records it", () => {
    expect(() =>
      guardHomeAction(
        { actor: "brainiac-mac/follow-up", action: "draft SMS reply", costUsd: 0 },
        env(),
      ),
    ).not.toThrow();
    expect(verifyAuditChain(audit()).ok).toBe(true);
  });

  it("blocks when halted", () => {
    engageHalt("stop", { killFile: killFile() });
    expect(() =>
      guardHomeAction({ actor: "brainiac-win", action: "anything" }, env()),
    ).toThrow(HomeBrainHaltedError);
  });

  it("blocks PII headed to a cloud model", () => {
    expect(() =>
      guardHomeAction(
        {
          actor: "brainiac-mac",
          action: "summarize client file",
          content: "client SSN 123-45-6789",
          destination: "cloud",
        },
        env(),
      ),
    ).toThrow(PiiFirewallError);
  });

  it("blocks when the daily cap would be breached", () => {
    recordSpend(9.99, { ledgerFile: ledgerFile(), now: FIXED });
    expect(() =>
      guardHomeAction(
        { actor: "brainiac-mac", action: "big cloud call", costUsd: 1, capUsd: 10 },
        env(),
      ),
    ).toThrow(SpendCapExceededError);
  });

  it("blocks an irreversible action with no owner approval", () => {
    expect(() =>
      guardHomeAction(
        {
          actor: "brainiac-mac",
          action: "send customer SMS",
          gatedType: "customer_message",
        },
        env(),
      ),
    ).toThrow(HomeApprovalRequiredError);
  });

  it("allows an irreversible action once the owner has approved it", () => {
    expect(() =>
      guardHomeAction(
        {
          actor: "brainiac-mac",
          action: "send customer SMS",
          gatedType: "customer_message",
          approval: approved,
        },
        env(),
      ),
    ).not.toThrow();
  });

  it("records a blocked entry to the audit chain on failure", () => {
    try {
      guardHomeAction(
        {
          actor: "brainiac-win",
          action: "pay commission",
          gatedType: "pay_commission",
        },
        env(),
      );
    } catch {
      /* expected */
    }
    const res = verifyAuditChain(audit());
    expect(res.ok).toBe(true);
    expect(res.count).toBe(1);
  });
});
