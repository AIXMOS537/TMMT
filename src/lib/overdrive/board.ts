import type { BoardRow, CapturedTask, Hint, Status, Tier } from "./types";
import { BOARD_COLUMNS } from "./types";

export const BOARD_HEADER = `# ${BOARD_COLUMNS.join("\t")}`;

export function tierForHint(hint: Hint): Tier {
  return hint === "easy" ? 0 : hint === "med" ? 1 : 2;
}

export function parseBoard(tsv: string): BoardRow[] {
  return tsv
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((line) => {
      const c = line.split("\t");
      return {
        id: Number(c[0]),
        status: (c[1] as Status) ?? "TODO",
        machine: c[2] ?? "",
        branch: c[3] ?? "",
        lane: (c[4] as BoardRow["lane"]) ?? "general",
        tier: (Number(c[5]) as Tier) || 0,
        lease: c[6] ?? "",
        task: c[7] ?? "",
        log: c[8] ?? "",
      };
    });
}

export function serializeBoard(rows: BoardRow[]): string {
  const body = rows
    .map((r) =>
      [r.id, r.status, r.machine, r.branch, r.lane, r.tier, r.lease, r.task, r.log].join("\t"),
    )
    .join("\n");
  return body ? `${BOARD_HEADER}\n${body}\n` : `${BOARD_HEADER}\n`;
}

export function nextId(rows: BoardRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

export function addTask(rows: BoardRow[], t: CapturedTask): BoardRow[] {
  const id = nextId(rows);
  return [
    ...rows,
    {
      id,
      status: "TODO",
      machine: "",
      branch: "",
      lane: t.lane,
      tier: tierForHint(t.hint),
      lease: "",
      task: t.title,
      log: "",
    },
  ];
}

export function claim(rows: BoardRow[], id: number, machine: string, leaseIso: string): BoardRow[] {
  return rows.map((r) =>
    r.id === id
      ? { ...r, status: "CLAIMED" as Status, machine, branch: `swarm/${machine}/${id}`, lease: leaseIso }
      : r,
  );
}

export function mark(
  rows: BoardRow[],
  id: number,
  status: Status,
  patch: Partial<BoardRow> = {},
): BoardRow[] {
  return rows.map((r) => (r.id === id ? { ...r, status, ...patch } : r));
}
