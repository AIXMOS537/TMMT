import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBoard, serializeBoard, BOARD_HEADER } from "../../src/lib/overdrive/board";
import type { BoardRow } from "../../src/lib/overdrive/types";

const BRANCH = "overdrive-coord";
const FILE = "board.tsv";
const git = (args: string[], cwd?: string) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function ensureBranch(): void {
  try {
    git(["fetch", "-q", "origin", BRANCH]);
  } catch {
    const tmp = mkdtempSync(join(tmpdir(), "od-init-"));
    git(["worktree", "add", "-q", "--detach", tmp]);
    try {
      git(["checkout", "-q", "--orphan", BRANCH], tmp);
      git(["rm", "-rfq", "--ignore-unmatch", "."], tmp);
      writeFileSync(join(tmp, FILE), `${BOARD_HEADER}\n`);
      git(["add", FILE], tmp);
      git(["-c", "user.name=overdrive", "-c", "user.email=overdrive@tmmt", "commit", "-qm", "overdrive: init board [skip ci]"], tmp);
      git(["push", "-q", "origin", `HEAD:${BRANCH}`], tmp);
    } finally {
      git(["worktree", "remove", "--force", tmp]);
    }
  }
}

export function readBoard(): BoardRow[] {
  ensureBranch();
  git(["fetch", "-q", "origin", BRANCH]);
  return parseBoard(git(["show", `origin/${BRANCH}:${FILE}`]));
}

/** Atomically transform the board: fetch -> edit -> push, retrying on race. */
export async function withBoard(fn: (rows: BoardRow[]) => BoardRow[]): Promise<BoardRow[]> {
  ensureBranch();
  for (let attempt = 1; attempt <= 5; attempt++) {
    git(["fetch", "-q", "origin", BRANCH]);
    const tmp = mkdtempSync(join(tmpdir(), "od-edit-"));
    git(["worktree", "add", "-q", "--detach", tmp, `origin/${BRANCH}`]);
    try {
      const before = readFileSync(join(tmp, FILE), "utf8");
      const next = fn(parseBoard(before));
      const out = serializeBoard(next);
      if (out === before) return next;
      writeFileSync(join(tmp, FILE), out);
      git(["add", FILE], tmp);
      git(["-c", "user.name=overdrive", "-c", "user.email=overdrive@tmmt", "commit", "-qm", "overdrive: update board [skip ci]"], tmp);
      git(["push", "-q", "origin", `HEAD:${BRANCH}`], tmp);
      return next;
    } catch (e) {
      if (attempt === 5) throw e;
    } finally {
      git(["worktree", "remove", "--force", tmp]);
    }
  }
  throw new Error("withBoard: exhausted retries");
}
