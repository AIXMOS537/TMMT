import type { BoardRow } from "./types";

export function reclaimStale(rows: BoardRow[], nowIso: string): BoardRow[] {
  const now = Date.parse(nowIso);
  return rows.map((r) => {
    const active = r.status === "CLAIMED" || r.status === "DOING";
    if (active && r.lease && Date.parse(r.lease) < now) {
      return { ...r, status: "TODO", machine: "", branch: "", lease: "", log: `${r.log} reclaimed`.trim() };
    }
    return r;
  });
}
