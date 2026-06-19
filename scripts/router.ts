import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readBoard, withBoard } from "./overdrive/git-coord";
import { isOwnerUnlocked } from "./overdrive/session";
import { claim, mark } from "../src/lib/overdrive/board";
import { reclaimStale } from "../src/lib/overdrive/reaper";
import { pickStartTier, escalate } from "../src/lib/overdrive/cost-ladder";
import { runTier } from "../src/lib/overdrive/exec";
import { formatNotification, sendImessage } from "../src/lib/overdrive/notify";
import { appendLedger, readLedger } from "../src/lib/overdrive/ledger";
import type { BoardRow, Hint, Tier } from "../src/lib/overdrive/types";

const HOME = homedir();
const TMMT = join(HOME, "Projects/TMMT");
const LEDGER = join(HOME, ".tmmt/ledger.tsv");
const SCRATCH = join(HOME, ".tmmt/scratch");
const RELAY = process.env.OVERDRIVE_RELAY ?? "http://100.77.126.8:8787";
const INTERVAL = Number(process.env.ROUTER_INTERVAL ?? 20) * 1000;
const LEASE_MIN = Number(process.env.ROUTER_LEASE ?? 30);
const DRYRUN = process.env.ROUTER_DRYRUN === "1";
const LOCAL_ONLY = process.env.OVERDRIVE_LOCAL_ONLY === "1";

const machine = (): string => {
  try {
    return execFileSync("cat", [join(TMMT, ".swarm/machine")], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
};
const isDark = (): boolean => existsSync(join(TMMT, "auth/DARK"));
const nowPlus = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const hintOf = (tier: Tier): Hint => (tier === 0 ? "easy" : tier === 1 ? "med" : "hard");

function gate(cwd: string, lane: BoardRow["lane"]): boolean {
  if (lane !== "code") return true;
  try {
    execFileSync("npm", ["run", "build"], { cwd, stdio: "ignore" });
    execFileSync("npm", ["test"], { cwd, stdio: "ignore" });
    execFileSync("npm", ["run", "lint"], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function runTask(row: BoardRow): Promise<void> {
  const me = machine();
  const dir = row.lane === "code" ? join(HOME, `TMMT-swarm/${row.id}`) : join(SCRATCH, String(row.id));
  mkdirSync(dir, { recursive: true });
  if (row.lane === "code") {
    execFileSync("git", ["worktree", "add", "-q", "--detach", dir], { cwd: TMMT });
  }
  const taskFile = join(dir, ".overdrive-task.txt");
  writeFileSync(taskFile, row.task);

  const ledger = readLedger(LEDGER);
  const startTier = LOCAL_ONLY ? 0 : pickStartTier(hintOf(row.tier), ledger, row.lane);
  let tier: Tier = startTier;
  let ok = false;
  let used: Tier = tier;

  for (;;) {
    if (DRYRUN) {
      console.log(`[dryrun] #${row.id} would run tier ${tier} in ${dir}`);
      ok = true;
      used = tier;
      break;
    }
    const res = await runTier(tier, taskFile, dir);
    used = tier;
    if (res.ok && gate(dir, row.lane)) {
      ok = true;
      break;
    }
    const next = LOCAL_ONLY ? null : escalate(tier);
    if (next === null) break;
    tier = next;
  }

  const approxCost = used === 0 ? 0 : used === 1 ? 0.003 : 0.05;
  const result: "DONE" | "FAILED" = ok ? "DONE" : "FAILED";

  if (ok && row.lane === "code" && !DRYRUN) {
    try {
      execFileSync("git", ["add", "-A"], { cwd: dir });
      execFileSync("git", ["commit", "-qm", `overdrive #${row.id}: ${row.task}`.slice(0, 90)], { cwd: dir });
      execFileSync("git", ["push", "-q", "-u", "origin", row.branch], { cwd: dir });
    } catch {
      /* nothing to push is fine */
    }
  }

  await withBoard((rows) => mark(rows, row.id, result, { tier: used, lease: "", log: `t${used} ${result}` }));
  appendLedger(LEDGER, {
    ts: new Date().toISOString(), taskId: row.id, lane: row.lane, hint: hintOf(row.tier),
    tierStarted: startTier, tierSucceeded: ok ? used : -1,
    result, approxCost, machine: me,
  });
  await sendImessage(formatNotification({ ...row, machine: me }, result, ok ? used : -1, approxCost), RELAY);

  if (row.lane === "code") {
    try {
      execFileSync("git", ["worktree", "remove", "--force", dir], { cwd: TMMT });
    } catch {
      /* ignore */
    }
  }
}

async function tick(): Promise<void> {
  if (isDark()) {
    console.log("router: dark — parked.");
    return;
  }
  if (!isOwnerUnlocked()) {
    console.log("router: locked — run `x unlock` to take control.");
    return;
  }
  const me = machine();
  await withBoard((rows) => reclaimStale(rows, new Date().toISOString()));
  const board = readBoard();
  const todo = board.find((r) => r.status === "TODO");
  if (!todo) return;

  let claimed: BoardRow | undefined;
  await withBoard((rows) => {
    const target = rows.find((r) => r.id === todo.id && r.status === "TODO");
    if (!target) return rows;
    claimed = { ...target, status: "CLAIMED", machine: me, branch: `swarm/${me}/${target.id}`, lease: nowPlus(LEASE_MIN) };
    return claim(rows, target.id, me, nowPlus(LEASE_MIN));
  });
  if (claimed) {
    console.log(`router: claimed #${claimed.id} (${claimed.lane})`);
    await runTask(claimed);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "up";
  if (mode === "once") {
    await tick();
    return;
  }
  console.log(`router: up on ${machine()} every ${INTERVAL / 1000}s (dryrun=${DRYRUN}, localOnly=${LOCAL_ONLY})`);
  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.error("router tick error:", e);
    }
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
}

main();
