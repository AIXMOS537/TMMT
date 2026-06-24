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

function auditFile(opts?: AuditOptions): string {
  const dir =
    opts?.auditDir ??
    process.env.AIXMOS_AUDIT_DIR ??
    path.join(aixmosHome(), "audit");
  return path.join(dir, "home-brain-audit.jsonl");
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
  return rec;
}

export interface AuditVerifyResult {
  ok: boolean;
  count: number;
  brokenAtSeq?: number;
}

/** Walk the chain from genesis; returns ok:false at the first tampered record. */
export function verifyAuditChain(opts?: AuditOptions): AuditVerifyResult {
  const all = readAll(opts);
  let prevHash = GENESIS;
  for (const rec of all) {
    const { hash, ...base } = rec;
    if (base.prevHash !== prevHash) {
      return { ok: false, count: all.length, brokenAtSeq: rec.seq };
    }
    if (hashOf(base) !== hash) {
      return { ok: false, count: all.length, brokenAtSeq: rec.seq };
    }
    prevHash = hash;
  }
  return { ok: true, count: all.length };
}
