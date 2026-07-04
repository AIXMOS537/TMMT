/**
 * shared/home-brain/audit-log.ts
 *
 * Tamper-evident, append-only audit log for the home brain, written to the NAS
 * tier (default <home>/audit/home-brain-audit.jsonl; point AIXMOS_AUDIT_DIR at
 * the UGREEN NAS mount). Every action the brain takes OR is blocked from taking
 * is recorded and hash-chained: each record's hash covers the previous hash, so
 * any edit/deletion to history is detectable by verifyAuditChain().
 *
 * This is how the owner can step back and still always answer "what did my
 * autonomous AI actually do?".
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { aixmosHome } from "./kill-switch";

export interface AuditOptions {
  auditDir?: string;
  /** Injectable clock for tests. */
  now?: Date;
}

export interface AuditInput {
  actor: string;
  action: string;
  detail?: Record<string, unknown>;
}

export interface AuditRecord {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  detail?: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

const GENESIS = "0".repeat(64);

function auditDirOf(opts?: AuditOptions): string {
  return (
    opts?.auditDir ??
    process.env.AIXMOS_AUDIT_DIR ??
    path.join(aixmosHome(), "audit")
  );
}

function auditFile(opts?: AuditOptions): string {
  return path.join(auditDirOf(opts), "home-brain-audit.jsonl");
}

/**
 * Sidecar recording the expected {count, hash} of the chain tip. It lets
 * verifyAuditChain catch TRUNCATION and full WIPE of the log — a valid prefix
 * or an empty file would otherwise pass. (Note: an attacker with write access
 * to BOTH files could still forge a consistent pair — for adversarial tamper-
 * proofing the tip must be shipped off-box. This catches naive truncation and
 * accidental deletion, which is the realistic threat here.)
 */
function tipFile(opts?: AuditOptions): string {
  return path.join(auditDirOf(opts), "home-brain-audit.tip.json");
}

interface AuditTip {
  count: number;
  hash: string;
}

function readTip(opts?: AuditOptions): AuditTip | null {
  try {
    return JSON.parse(fs.readFileSync(tipFile(opts), "utf8")) as AuditTip;
  } catch {
    return null;
  }
}

function hashOf(base: Omit<AuditRecord, "hash">): string {
  return createHash("sha256").update(base.prevHash + JSON.stringify(base)).digest("hex");
}

function readAll(opts?: AuditOptions): AuditRecord[] {
  try {
    return fs
      .readFileSync(auditFile(opts), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditRecord);
  } catch {
    return [];
  }
}

export function appendAudit(input: AuditInput, opts?: AuditOptions): AuditRecord {
  const f = auditFile(opts);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const all = readAll(opts);
  const prev = all[all.length - 1];
  const prevHash = prev ? prev.hash : GENESIS;
  const now = opts?.now ?? new Date();
  const base: Omit<AuditRecord, "hash"> = {
    seq: prev ? prev.seq + 1 : 0,
    ts: now.toISOString(),
    actor: input.actor,
    action: input.action,
    detail: input.detail,
    prevHash,
  };
  const rec: AuditRecord = { ...base, hash: hashOf(base) };
  fs.appendFileSync(f, JSON.stringify(rec) + "\n", "utf8");
  // Record the new tip so truncation/wipe of the log is detectable.
  const tip: AuditTip = { count: rec.seq + 1, hash: rec.hash };
  fs.writeFileSync(tipFile(opts), JSON.stringify(tip), "utf8");
  return rec;
}

export interface AuditVerifyResult {
  ok: boolean;
  count: number;
  brokenAtSeq?: number;
  reason?: string;
}

/**
 * Walk the chain from genesis; returns ok:false at the first tampered record.
 * Then cross-checks the recorded tip so TRUNCATION and full WIPE are caught too
 * (a valid prefix / empty file passes the walk but fails the tip check).
 */
export function verifyAuditChain(opts?: AuditOptions): AuditVerifyResult {
  const all = readAll(opts);
  let prevHash = GENESIS;
  for (const rec of all) {
    const { hash, ...base } = rec;
    if (base.prevHash !== prevHash) {
      return { ok: false, count: all.length, brokenAtSeq: rec.seq, reason: "prevHash break" };
    }
    if (hashOf(base) !== hash) {
      return { ok: false, count: all.length, brokenAtSeq: rec.seq, reason: "hash mismatch" };
    }
    prevHash = hash;
  }

  // Tip cross-check: detects tail-truncation and full wipe.
  const tip = readTip(opts);
  if (tip) {
    if (all.length !== tip.count) {
      return {
        ok: false,
        count: all.length,
        reason: `truncation: ${all.length} records but tip expects ${tip.count}`,
      };
    }
    if (prevHash !== tip.hash) {
      return { ok: false, count: all.length, reason: "tip hash mismatch" };
    }
  } else if (all.length > 0) {
    return { ok: false, count: all.length, reason: "tip sidecar missing" };
  }

  return { ok: true, count: all.length };
}
