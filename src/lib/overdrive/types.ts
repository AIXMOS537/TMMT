export type Lane = "code" | "general";
export type Hint = "easy" | "med" | "hard";
export type Tier = 0 | 1 | 2;
export type Status = "TODO" | "CLAIMED" | "DOING" | "DONE" | "FAILED";

export interface CapturedTask {
  title: string;
  lane: Lane;
  hint: Hint;
  repo: string | null;
}

export interface BoardRow {
  id: number;
  status: Status;
  machine: string; // "" when unclaimed
  branch: string; // "" until claimed
  lane: Lane;
  tier: Tier; // current attempt tier
  lease: string; // ISO timestamp or ""
  task: string; // the title / instruction
  log: string; // short breadcrumb
}

export interface LedgerEntry {
  ts: string;
  taskId: number;
  lane: Lane;
  hint: Hint;
  tierStarted: Tier;
  tierSucceeded: Tier | -1; // -1 = failed at all tiers
  result: "DONE" | "FAILED";
  approxCost: number;
  machine: string;
}

export const BOARD_COLUMNS = [
  "id",
  "status",
  "machine",
  "branch",
  "lane",
  "tier",
  "lease",
  "task",
  "log",
] as const;
