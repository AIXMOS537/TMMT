# Operation Overdrive — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the carry-Mac capture → mesh route → iMessage-notify core loop with a Watchtower command view, on the cheapest engine that passes a test gate, without touching the live swarm.

**Architecture:** Pure logic lives in TypeScript modules under `src/lib/overdrive/` (unit-tested by the repo's existing vitest). Three runnable entrypoints (`scripts/catch.ts`, `scripts/router.ts`, `scripts/overdrive.ts`) run via `tsx` and are fronted by one-word bash wrappers. Coordination uses a **dedicated remote-only branch `overdrive-coord`** with its own `board.tsv` (so the existing `swarm.sh`/`swarm-coord` board is never modified). The router runs work up a cost ladder (Ollama → Claude Haiku → Claude Opus) and gates code tasks on `build + test + lint`. Deploys stay behind `scripts/ship`.

**Tech Stack:** TypeScript (strict), vitest, `tsx` (run TS directly, no build), Node's `child_process` for git + Claude CLI + Ollama HTTP API (`http://localhost:11434`), the live iMessage relay (`http://100.77.126.8:8787`), bash one-word wrappers + a macOS LaunchAgent for always-on.

---

## File Structure

**Pure logic (TS, vitest-tested):**
- `src/lib/overdrive/types.ts` — shared types (`Lane`, `Hint`, `Tier`, `Status`, `BoardRow`, `CapturedTask`, `LedgerEntry`).
- `src/lib/overdrive/board.ts` — board.tsv parse/serialize + `addTask`/`claim`/`mark`/`nextId`/`tierForHint`.
- `src/lib/overdrive/parse-capture.ts` — `parseCapture(raw, llm)` braindump → tasks, with safe fallback.
- `src/lib/overdrive/cost-ladder.ts` — `pickStartTier`, `escalate`.
- `src/lib/overdrive/reaper.ts` — `reclaimStale` (lease expiry → TODO).
- `src/lib/overdrive/notify.ts` — `formatNotification` (pure) + `sendImessage` (IO).
- `src/lib/overdrive/ledger.ts` — `formatLedgerLine`/`parseLedger` (pure) + `appendLedger`/`readLedger` (IO).
- `src/lib/overdrive/exec.ts` — `buildTierCommand` (pure) + `runTier` (IO).

**Entrypoints (TS via tsx):**
- `scripts/overdrive/git-coord.ts` — atomic `readBoard()` / `withBoard(fn)` over `overdrive-coord`.
- `scripts/catch.ts` — capture CLI.
- `scripts/router.ts` — always-on worker daemon.
- `scripts/overdrive.ts` — Watchtower view.

**Glue:**
- `scripts/catch`, `scripts/router`, `scripts/overdrive` — bash wrappers (`exec npx tsx …`).
- `scripts/overdrive/com.tmmt.router.plist` — LaunchAgent template.
- `docs/OPERATION-OVERDRIVE.md` — operator/owner runbook.

---

## Task 0: Scaffolding + types + tsx

**Files:**
- Create: `src/lib/overdrive/types.ts`
- Modify: `package.json` (add `tsx` devDependency + scripts)
- Test: `src/lib/overdrive/types.test.ts`

- [ ] **Step 1: Add `tsx` and convenience scripts**

Run:
```bash
cd ~/Projects/TMMT && npm i -D tsx
```
Expected: `tsx` added to devDependencies, exit 0.

- [ ] **Step 2: Add npm scripts**

Modify `package.json` `"scripts"` to add:
```json
"catch": "tsx scripts/catch.ts",
"router": "tsx scripts/router.ts",
"overdrive": "tsx scripts/overdrive.ts"
```

- [ ] **Step 3: Write the types module**

Create `src/lib/overdrive/types.ts`:
```ts
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
```

- [ ] **Step 4: Write a smoke test**

Create `src/lib/overdrive/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { BOARD_COLUMNS } from "./types";

describe("overdrive types", () => {
  it("board has the 9 expected columns in order", () => {
    expect(BOARD_COLUMNS).toEqual([
      "id", "status", "machine", "branch", "lane", "tier", "lease", "task", "log",
    ]);
  });
});
```

- [ ] **Step 5: Run + commit**

Run: `npx vitest run src/lib/overdrive/types.test.ts`
Expected: 1 passed.
```bash
git add package.json package-lock.json src/lib/overdrive/types.ts src/lib/overdrive/types.test.ts
git commit -m "feat(overdrive): scaffold types + tsx runner"
```

---

## Task 1: Board module (the task board)

**Files:**
- Create: `src/lib/overdrive/board.ts`
- Test: `src/lib/overdrive/board.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overdrive/board.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  parseBoard, serializeBoard, nextId, tierForHint, addTask, claim, mark, BOARD_HEADER,
} from "./board";
import type { BoardRow } from "./types";

const sample: BoardRow[] = [
  { id: 1, status: "DONE", machine: "rick", branch: "swarm/rick/1", lane: "code", tier: 1, lease: "", task: "do a thing", log: "haiku ok" },
  { id: 2, status: "TODO", machine: "", branch: "", lane: "general", tier: 0, lease: "", task: "draft a note", log: "" },
];

describe("board", () => {
  it("round-trips parse(serialize(rows))", () => {
    const tsv = serializeBoard(sample);
    expect(tsv.startsWith(BOARD_HEADER)).toBe(true);
    expect(parseBoard(tsv)).toEqual(sample);
  });

  it("parse ignores blank lines and the header", () => {
    const tsv = `${BOARD_HEADER}\n\n1\tTODO\t\t\tgeneral\t0\t\thello\t\n`;
    const rows = parseBoard(tsv);
    expect(rows).toHaveLength(1);
    expect(rows[0].task).toBe("hello");
  });

  it("nextId returns max+1, or 1 when empty", () => {
    expect(nextId(sample)).toBe(3);
    expect(nextId([])).toBe(1);
  });

  it("tierForHint maps easy/med/hard to 0/1/2", () => {
    expect(tierForHint("easy")).toBe(0);
    expect(tierForHint("med")).toBe(1);
    expect(tierForHint("hard")).toBe(2);
  });

  it("addTask appends a TODO row with tier from hint", () => {
    const rows = addTask([], { title: "ship it", lane: "code", hint: "hard", repo: "TMMT" });
    expect(rows[0]).toMatchObject({ id: 1, status: "TODO", lane: "code", tier: 2, task: "ship it" });
  });

  it("claim sets machine, branch, lease and CLAIMED", () => {
    const rows = claim(addTask([], { title: "x", lane: "general", hint: "easy", repo: null }), 1, "rick", "2026-06-18T00:30:00Z");
    expect(rows[0]).toMatchObject({ status: "CLAIMED", machine: "rick", branch: "swarm/rick/1", lease: "2026-06-18T00:30:00Z" });
  });

  it("mark updates status and merges a patch", () => {
    const rows = mark(sample, 2, "FAILED", { log: "opus failed" });
    expect(rows.find((r) => r.id === 2)).toMatchObject({ status: "FAILED", log: "opus failed" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/overdrive/board.test.ts`
Expected: FAIL — "Failed to resolve import './board'".

- [ ] **Step 3: Implement the board module**

Create `src/lib/overdrive/board.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/overdrive/board.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**
```bash
git add src/lib/overdrive/board.ts src/lib/overdrive/board.test.ts
git commit -m "feat(overdrive): board.tsv parse/serialize + mutators"
```

---

## Task 2: Capture parser (braindump → tasks)

**Files:**
- Create: `src/lib/overdrive/parse-capture.ts`
- Test: `src/lib/overdrive/parse-capture.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overdrive/parse-capture.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseCapture } from "./parse-capture";

describe("parseCapture", () => {
  it("returns [] for empty input", async () => {
    expect(await parseCapture("   ", async () => "[]")).toEqual([]);
  });

  it("parses valid LLM JSON into coerced tasks", async () => {
    const llm = async () =>
      '[{"title":"fix the login bug","lane":"code","hint":"med","repo":"TMMT"}]';
    const tasks = await parseCapture("login is broken", llm);
    expect(tasks).toEqual([
      { title: "fix the login bug", lane: "code", hint: "med", repo: "TMMT" },
    ]);
  });

  it("coerces invalid lane/hint to safe defaults", async () => {
    const llm = async () => '[{"title":"x","lane":"weird","hint":"nope"}]';
    const tasks = await parseCapture("x", llm);
    expect(tasks[0]).toEqual({ title: "x", lane: "general", hint: "med", repo: null });
  });

  it("falls back to one general task when the LLM returns junk", async () => {
    const tasks = await parseCapture("buy milk and call Moe", async () => "not json");
    expect(tasks).toEqual([
      { title: "buy milk and call Moe", lane: "general", hint: "med", repo: null },
    ]);
  });

  it("falls back when the LLM throws (Ollama down)", async () => {
    const tasks = await parseCapture("do the thing", async () => {
      throw new Error("connection refused");
    });
    expect(tasks).toEqual([{ title: "do the thing", lane: "general", hint: "med", repo: null }]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/overdrive/parse-capture.test.ts`
Expected: FAIL — cannot resolve `./parse-capture`.

- [ ] **Step 3: Implement the parser**

Create `src/lib/overdrive/parse-capture.ts`:
```ts
import type { CapturedTask, Lane, Hint } from "./types";

export const CAPTURE_PROMPT = (raw: string) =>
  `You split a messy brain-dump into discrete work tasks.
Return ONLY a JSON array, no prose. Each item:
{"title": "<short imperative task>", "lane": "code"|"general", "hint": "easy"|"med"|"hard", "repo": "TMMT"|null}
"code" = changes to the TMMT software repo; "general" = research/writing/ops.
Brain-dump:
"""${raw}"""`;

const LANES: Lane[] = ["code", "general"];
const HINTS: Hint[] = ["easy", "med", "hard"];

function coerceTask(o: unknown): CapturedTask | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return null;
  return {
    title: title.slice(0, 300),
    lane: LANES.includes(r.lane as Lane) ? (r.lane as Lane) : "general",
    hint: HINTS.includes(r.hint as Hint) ? (r.hint as Hint) : "med",
    repo: r.repo === "TMMT" ? "TMMT" : null,
  };
}

function fallback(raw: string): CapturedTask[] {
  const title = raw.trim().slice(0, 300);
  return title ? [{ title, lane: "general", hint: "med", repo: null }] : [];
}

export async function parseCapture(
  raw: string,
  llm: (prompt: string) => Promise<string>,
): Promise<CapturedTask[]> {
  if (!raw.trim()) return [];
  let text: string;
  try {
    text = await llm(CAPTURE_PROMPT(raw));
  } catch {
    return fallback(raw);
  }
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return fallback(raw);
    const arr = JSON.parse(text.slice(start, end + 1)) as unknown[];
    const tasks = arr.map(coerceTask).filter((t): t is CapturedTask => t !== null);
    return tasks.length ? tasks : fallback(raw);
  } catch {
    return fallback(raw);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/overdrive/parse-capture.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**
```bash
git add src/lib/overdrive/parse-capture.ts src/lib/overdrive/parse-capture.test.ts
git commit -m "feat(overdrive): local braindump→tasks parser with safe fallback"
```

---

## Task 3: Cost ladder (which engine, and when to escalate)

**Files:**
- Create: `src/lib/overdrive/cost-ladder.ts`
- Test: `src/lib/overdrive/cost-ladder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overdrive/cost-ladder.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickStartTier, escalate } from "./cost-ladder";
import type { LedgerEntry } from "./types";

const ledgerFor = (lane: "code" | "general", hint: "easy" | "med" | "hard", tier: 0 | 1 | 2, n: number): LedgerEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    ts: "t", taskId: i, lane, hint, tierStarted: 0, tierSucceeded: tier,
    result: "DONE" as const, approxCost: 0, machine: "rick",
  }));

describe("cost ladder", () => {
  it("starts at the hint's tier with no history", () => {
    expect(pickStartTier("easy", [], "general")).toBe(0);
    expect(pickStartTier("med", [], "code")).toBe(1);
    expect(pickStartTier("hard", [], "code")).toBe(2);
  });

  it("bumps the start tier when history shows the cheap tier usually fails", () => {
    // 4 of 5 'code/med' jobs only succeeded at tier 2 → start at 2
    const ledger = [...ledgerFor("code", "med", 2, 4), ...ledgerFor("code", "med", 1, 1)];
    expect(pickStartTier("med", ledger, "code")).toBe(2);
  });

  it("ignores history for a different lane/hint", () => {
    const ledger = ledgerFor("general", "easy", 2, 5);
    expect(pickStartTier("med", ledger, "code")).toBe(1);
  });

  it("needs at least 3 samples before learning kicks in", () => {
    const ledger = ledgerFor("code", "med", 2, 2);
    expect(pickStartTier("med", ledger, "code")).toBe(1);
  });

  it("escalate goes up one tier, null at the top", () => {
    expect(escalate(0)).toBe(1);
    expect(escalate(1)).toBe(2);
    expect(escalate(2)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/overdrive/cost-ladder.test.ts`
Expected: FAIL — cannot resolve `./cost-ladder`.

- [ ] **Step 3: Implement the cost ladder**

Create `src/lib/overdrive/cost-ladder.ts`:
```ts
import type { Hint, Lane, LedgerEntry, Tier } from "./types";
import { tierForHint } from "./board";

const MIN_SAMPLES = 3;
const BUMP_RATIO = 0.6;

export function pickStartTier(hint: Hint, ledger: LedgerEntry[], lane: Lane): Tier {
  const base = tierForHint(hint);
  const relevant = ledger.filter(
    (e) => e.lane === lane && e.hint === hint && e.result === "DONE" && e.tierSucceeded >= 0,
  );
  if (relevant.length < MIN_SAMPLES) return base;
  // If a strong majority needed a higher tier than `base`, start there.
  const higher = relevant.filter((e) => e.tierSucceeded > base);
  if (higher.length / relevant.length >= BUMP_RATIO) {
    const want = Math.max(...higher.map((e) => e.tierSucceeded)) as Tier;
    return Math.min(want, 2) as Tier;
  }
  return base;
}

export function escalate(tier: Tier): Tier | null {
  return tier < 2 ? ((tier + 1) as Tier) : null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/overdrive/cost-ladder.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**
```bash
git add src/lib/overdrive/cost-ladder.ts src/lib/overdrive/cost-ladder.test.ts
git commit -m "feat(overdrive): cost-ladder start-tier + escalation with ledger learning"
```

---

## Task 4: Reaper (stale-task reclaim)

**Files:**
- Create: `src/lib/overdrive/reaper.ts`
- Test: `src/lib/overdrive/reaper.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overdrive/reaper.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { reclaimStale } from "./reaper";
import type { BoardRow } from "./types";

const row = (over: Partial<BoardRow>): BoardRow => ({
  id: 1, status: "CLAIMED", machine: "rick", branch: "swarm/rick/1",
  lane: "code", tier: 1, lease: "", task: "t", log: "", ...over,
});

describe("reclaimStale", () => {
  const now = "2026-06-18T01:00:00Z";

  it("requeues a CLAIMED task whose lease has expired", () => {
    const out = reclaimStale([row({ lease: "2026-06-18T00:30:00Z" })], now);
    expect(out[0]).toMatchObject({ status: "TODO", machine: "", branch: "", lease: "" });
    expect(out[0].log).toContain("reclaimed");
  });

  it("leaves a task whose lease is still in the future", () => {
    const out = reclaimStale([row({ lease: "2026-06-18T02:00:00Z" })], now);
    expect(out[0].status).toBe("CLAIMED");
  });

  it("never touches DONE/TODO/FAILED rows", () => {
    const rows = [row({ status: "DONE", lease: "2026-06-18T00:00:00Z" })];
    expect(reclaimStale(rows, now)).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/overdrive/reaper.test.ts`
Expected: FAIL — cannot resolve `./reaper`.

- [ ] **Step 3: Implement the reaper**

Create `src/lib/overdrive/reaper.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/overdrive/reaper.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**
```bash
git add src/lib/overdrive/reaper.ts src/lib/overdrive/reaper.test.ts
git commit -m "feat(overdrive): lease-expiry reaper requeues stranded tasks"
```

---

## Task 5: Notify (iMessage report)

**Files:**
- Create: `src/lib/overdrive/notify.ts`
- Test: `src/lib/overdrive/notify.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overdrive/notify.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { formatNotification, sendImessage } from "./notify";
import type { BoardRow } from "./types";

const r: BoardRow = {
  id: 12, status: "DONE", machine: "rick", branch: "swarm/rick/12",
  lane: "code", tier: 1, lease: "", task: "fix login", log: "",
};

describe("formatNotification", () => {
  it("formats a success with engine + branch", () => {
    expect(formatNotification(r, "DONE", 1, 0.003)).toBe(
      "✅ #12 done by rick (Haiku ~$0.003) — fix login → swarm/rick/12",
    );
  });
  it("formats a failure that needs the owner", () => {
    expect(formatNotification({ ...r, status: "FAILED" }, "FAILED", -1, 0.05)).toBe(
      "❌ #12 FAILED (after Opus ~$0.05) — fix login — needs you",
    );
  });
});

describe("sendImessage", () => {
  it("POSTs the text to the relay", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true });
    await sendImessage("hi", "http://relay:8787", fakeFetch as unknown as typeof fetch);
    expect(fakeFetch).toHaveBeenCalledWith(
      "http://relay:8787/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("never throws when the relay is unreachable", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("down"));
    await expect(sendImessage("hi", "http://relay:8787", fakeFetch as unknown as typeof fetch)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/overdrive/notify.test.ts`
Expected: FAIL — cannot resolve `./notify`.

- [ ] **Step 3: Implement notify**

Create `src/lib/overdrive/notify.ts`:
```ts
import type { BoardRow, Tier } from "./types";

const ENGINE = ["local", "Haiku", "Opus"] as const;

export function formatNotification(
  row: BoardRow,
  result: "DONE" | "FAILED",
  tierUsed: Tier | -1,
  approxCost: number,
): string {
  const cost = `~$${approxCost.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0")}`;
  if (result === "DONE") {
    const eng = ENGINE[tierUsed as Tier] ?? "local";
    return `✅ #${row.id} done by ${row.machine} (${eng} ${cost}) — ${row.task} → ${row.branch}`;
  }
  return `❌ #${row.id} FAILED (after Opus ${cost}) — ${row.task} — needs you`;
}

export async function sendImessage(
  text: string,
  relayUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchFn(`${relayUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Notification must never block task completion; relay retries next tick.
  }
}
```

> Note: the relay's exact POST shape (`/send` + `{text}`) is confirmed against
> `project_imessage_relay_live` memory at execution time; adjust the path/body in
> this one function if the live relay differs. Keep the signature identical.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/overdrive/notify.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**
```bash
git add src/lib/overdrive/notify.ts src/lib/overdrive/notify.test.ts
git commit -m "feat(overdrive): iMessage notification formatter + non-blocking send"
```

---

## Task 6: Ledger (the learning log)

**Files:**
- Create: `src/lib/overdrive/ledger.ts`
- Test: `src/lib/overdrive/ledger.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overdrive/ledger.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatLedgerLine, parseLedger } from "./ledger";
import type { LedgerEntry } from "./types";

const e: LedgerEntry = {
  ts: "2026-06-18T01:00:00Z", taskId: 12, lane: "code", hint: "med",
  tierStarted: 1, tierSucceeded: 2, result: "DONE", approxCost: 0.05, machine: "rick",
};

describe("ledger", () => {
  it("round-trips one entry through TSV", () => {
    const line = formatLedgerLine(e);
    expect(line.split("\t")).toHaveLength(9);
    expect(parseLedger(line)).toEqual([e]);
  });

  it("parse skips blank lines and comments", () => {
    const tsv = `# header\n\n${formatLedgerLine(e)}\n`;
    expect(parseLedger(tsv)).toEqual([e]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/overdrive/ledger.test.ts`
Expected: FAIL — cannot resolve `./ledger`.

- [ ] **Step 3: Implement the ledger**

Create `src/lib/overdrive/ledger.ts`:
```ts
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { Hint, Lane, LedgerEntry, Tier } from "./types";

export function formatLedgerLine(e: LedgerEntry): string {
  return [
    e.ts, e.taskId, e.lane, e.hint, e.tierStarted, e.tierSucceeded, e.result, e.approxCost, e.machine,
  ].join("\t");
}

export function parseLedger(tsv: string): LedgerEntry[] {
  return tsv
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((line) => {
      const c = line.split("\t");
      return {
        ts: c[0],
        taskId: Number(c[1]),
        lane: c[2] as Lane,
        hint: c[3] as Hint,
        tierStarted: Number(c[4]) as Tier,
        tierSucceeded: Number(c[5]) as Tier | -1,
        result: c[6] as "DONE" | "FAILED",
        approxCost: Number(c[7]),
        machine: c[8],
      };
    });
}

export function appendLedger(path: string, e: LedgerEntry): void {
  appendFileSync(path, `${formatLedgerLine(e)}\n`);
}

export function readLedger(path: string): LedgerEntry[] {
  return existsSync(path) ? parseLedger(readFileSync(path, "utf8")) : [];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/overdrive/ledger.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**
```bash
git add src/lib/overdrive/ledger.ts src/lib/overdrive/ledger.test.ts
git commit -m "feat(overdrive): cost/outcome ledger read+append"
```

---

## Task 7: Tier executor (command builder + runner)

**Files:**
- Create: `src/lib/overdrive/exec.ts`
- Test: `src/lib/overdrive/exec.test.ts`

- [ ] **Step 1: Write the failing tests** (pure command builder only)

Create `src/lib/overdrive/exec.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildTierCommand } from "./exec";

describe("buildTierCommand", () => {
  it("tier 0 runs the local Ollama model", () => {
    const cmd = buildTierCommand(0, "/wt/.overdrive-task.txt", "/wt");
    expect(cmd.bin).toBe("ollama");
    expect(cmd.args).toContain("llama3.2:3b");
  });
  it("tier 1 runs claude with the Haiku model id", () => {
    const cmd = buildTierCommand(1, "/wt/.overdrive-task.txt", "/wt");
    expect(cmd.bin).toBe("claude");
    expect(cmd.args).toContain("claude-haiku-4-5");
  });
  it("tier 2 runs claude with the Opus model id", () => {
    const cmd = buildTierCommand(2, "/wt/.overdrive-task.txt", "/wt");
    expect(cmd.bin).toBe("claude");
    expect(cmd.args).toContain("claude-opus-4-8");
  });
  it("claude tiers run inside the worktree cwd", () => {
    expect(buildTierCommand(2, "/wt/.overdrive-task.txt", "/wt").cwd).toBe("/wt");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/overdrive/exec.test.ts`
Expected: FAIL — cannot resolve `./exec`.

- [ ] **Step 3: Implement the executor**

Create `src/lib/overdrive/exec.ts`:
```ts
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

/** Pure: how to invoke a given tier on a task file inside a working dir. */
export function buildTierCommand(tier: Tier, taskFile: string, cwd: string): TierCommand {
  if (tier === 0) {
    return { bin: "ollama", args: ["run", LOCAL_MODEL], cwd };
  }
  return {
    bin: "claude",
    args: ["--model", MODEL[tier], "--print", "--permission-mode", "acceptEdits", readFileSync(taskFile, "utf8")],
    cwd,
  };
}

export interface RunResult {
  ok: boolean;
  output: string;
}

/** IO: run a tier to completion, capturing output. Tier 0 pipes the task as stdin. */
export function runTier(tier: Tier, taskFile: string, cwd: string, timeoutMs = 20 * 60_000): Promise<RunResult> {
  const cmd = buildTierCommand(tier, taskFile, cwd);
  return new Promise((resolve) => {
    const child = spawn(cmd.bin, cmd.args, { cwd: cmd.cwd, env: process.env });
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    if (tier === 0) {
      child.stdin.write(readFileSync(taskFile, "utf8"));
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
```

> Verify at execution time that the installed Claude CLI accepts `--print` and
> `--permission-mode acceptEdits` (run `claude --help`). If flags differ, fix them
> in `buildTierCommand` only — the tests assert the model id + cwd, not the flags.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/overdrive/exec.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**
```bash
git add src/lib/overdrive/exec.ts src/lib/overdrive/exec.test.ts
git commit -m "feat(overdrive): tier command builder + child-process runner"
```

---

## Task 8: Coordination transport (`overdrive-coord` branch)

**Files:**
- Create: `scripts/overdrive/git-coord.ts`

- [ ] **Step 1: Implement the atomic board transport**

Create `scripts/overdrive/git-coord.ts`:
```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    // Branch does not exist yet — create it from an empty board in a temp worktree.
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
  const tsv = git(["show", `origin/${BRANCH}:${FILE}`]);
  return parseBoard(tsv);
}

/** Atomically transform the board: fetch → edit → push, retrying on race. */
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
```

- [ ] **Step 2: Manual verification**

Run:
```bash
cd ~/Projects/TMMT
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(async m => { await m.withBoard(r => [...r, {id:1,status:'TODO',machine:'',branch:'',lane:'general',tier:0,lease:'',task:'hello overdrive',log:''}]); console.log(await m.readBoard()); })"
```
Expected: prints an array containing the `hello overdrive` row. Confirm a remote branch exists:
```bash
git ls-remote --heads origin overdrive-coord
```
Expected: one ref line. Confirm it did NOT create a Vercel deploy (auto-deploy is disconnected):
```bash
git show origin/overdrive-coord:board.tsv
```
Expected: header + the hello row.

- [ ] **Step 3: Clean the test row + commit the code**
```bash
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(m => m.withBoard(() => []))"
git add scripts/overdrive/git-coord.ts
git commit -m "feat(overdrive): atomic board transport on overdrive-coord branch"
```

---

## Task 9: `catch` — the capture entrypoint

**Files:**
- Create: `scripts/catch.ts`, `scripts/catch` (bash wrapper)

- [ ] **Step 1: Implement the capture CLI**

Create `scripts/catch.ts`:
```ts
import { readFileSync } from "node:fs";
import { parseCapture } from "../src/lib/overdrive/parse-capture";
import { addTask } from "../src/lib/overdrive/board";
import { withBoard } from "./overdrive/git-coord";
import { LOCAL_MODEL } from "../src/lib/overdrive/exec";

const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";

async function ollama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: LOCAL_MODEL, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "";
}

function readInput(): string {
  const arg = process.argv.slice(2).join(" ").trim();
  if (arg) return arg;
  try {
    return readFileSync(0, "utf8"); // stdin (paste / superwhisper pipe)
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  const raw = readInput();
  if (!raw.trim()) {
    console.error("catch: nothing to capture (pass text, pipe stdin, or use superwhisper).");
    process.exit(1);
  }
  const tasks = await parseCapture(raw, ollama);
  if (!tasks.length) {
    console.error("catch: no tasks parsed.");
    process.exit(1);
  }
  await withBoard((rows) => tasks.reduce((acc, t) => addTask(acc, t), rows));
  console.log(`catch: queued ${tasks.length} task(s):`);
  tasks.forEach((t) => console.log(`  • [${t.lane}/${t.hint}] ${t.title}`));
}

main().catch((e) => {
  console.error("catch failed:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Create the one-word bash wrapper**

Create `scripts/catch`:
```bash
#!/usr/bin/env bash
# Operation Overdrive — capture. Usage: catch "text"  |  echo text | catch  |  (superwhisper → ~/.tmmt/inbox)
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx scripts/catch.ts "$@"
```
Run: `chmod +x scripts/catch`

- [ ] **Step 3: Manual verification**

Run (Ollama running):
```bash
cd ~/Projects/TMMT
./scripts/catch "fix the login redirect bug in TMMT and also draft a Friday recap email"
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(async m => console.log(await m.readBoard()))"
```
Expected: 2 queued tasks printed, board shows a `code` task and a `general` task.

Run (Ollama stopped — fallback):
```bash
OLLAMA_URL=http://localhost:1 ./scripts/catch "one raw line"
```
Expected: 1 queued `general/med` task (never lost).

- [ ] **Step 4: Clear test rows + commit**
```bash
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(m => m.withBoard(() => []))"
git add scripts/catch.ts scripts/catch
git commit -m "feat(overdrive): catch capture entrypoint (voice/paste/arg → board)"
```

---

## Task 10: `router` — the always-on worker daemon

**Files:**
- Create: `scripts/router.ts`, `scripts/router` (bash wrapper)

- [ ] **Step 1: Implement the daemon**

Create `scripts/router.ts`:
```ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readBoard, withBoard } from "./overdrive/git-coord";
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
  let tier = pickStartTier(hintOf(row.tier), ledger, row.lane);
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
    const next = escalate(tier);
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
    tierStarted: pickStartTier(hintOf(row.tier), ledger, row.lane), tierSucceeded: ok ? used : -1,
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
  console.log(`router: up on ${machine()} every ${INTERVAL / 1000}s (dryrun=${DRYRUN})`);
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
```

- [ ] **Step 2: Create the bash wrapper**

Create `scripts/router`:
```bash
#!/usr/bin/env bash
# Operation Overdrive — worker daemon. Usage: router [up|once]
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx scripts/router.ts "${1:-up}"
```
Run: `chmod +x scripts/router`

- [ ] **Step 3: Manual verification (dry-run, no spend, nothing cracks)**

Run:
```bash
cd ~/Projects/TMMT
./scripts/catch "create a file /tmp/overdrive-proof.txt containing the word WORKS"
ROUTER_DRYRUN=1 ./scripts/router once
```
Expected: logs `claimed #N` then `[dryrun] would run tier …`; board marks the task DONE; an iMessage arrives; no API spend. Verify the board:
```bash
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(async m => console.log(await m.readBoard()))"
```
Expected: the task shows `DONE`.

- [ ] **Step 4: Live single-task check (general lane, cheap)**

Run:
```bash
./scripts/catch "write one sentence explaining what TMMT does"
./scripts/router once
```
Expected: runs locally (tier 0), marks DONE, iMessage received. (Skip if Ollama not installed.)

- [ ] **Step 5: Clear test rows + commit**
```bash
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(m => m.withBoard(() => []))"
git add scripts/router.ts scripts/router
git commit -m "feat(overdrive): always-on router daemon (claim→cost-ladder→gate→notify)"
```

---

## Task 11: `overdrive` — the Watchtower view

**Files:**
- Create: `scripts/overdrive.ts`, `scripts/overdrive` (bash wrapper)

- [ ] **Step 1: Implement the view**

Create `scripts/overdrive.ts`:
```ts
import { execFileSync } from "node:child_process";
import { readBoard } from "./overdrive/git-coord";
import type { BoardRow } from "../src/lib/overdrive/types";

const ICON: Record<BoardRow["status"], string> = {
  TODO: "•", CLAIMED: "◴", DOING: "▶", DONE: "✅", FAILED: "❌",
};

function roster(): string {
  try {
    return execFileSync("bash", ["scripts/mesh/presence.sh", "who"], { encoding: "utf8" });
  } catch {
    return "(presence unavailable)";
  }
}

async function main(): Promise<void> {
  const board = await readBoard();
  const open = board.filter((r) => r.status !== "DONE");
  console.log("═══ OPERATION OVERDRIVE — WATCHTOWER ═══\n");
  console.log("WHO/WHAT IS ONLINE:");
  console.log(roster().trim() || "  (none)");
  console.log("\nJOBS:");
  if (!open.length) console.log("  (board clear)");
  for (const r of board.slice(-25)) {
    console.log(`  ${ICON[r.status]} #${r.id} [${r.lane}/t${r.tier}] ${r.task}  ${r.machine ? "@" + r.machine : ""}`);
  }
  console.log("\nCAPTURE:  ./scripts/catch \"...\"   ·   HAND TO PERSON:  ./scripts/overdrive assign <id> <name>");
}

async function assign(): Promise<void> {
  const [, , , idStr, name] = process.argv;
  const { withBoard } = await import("./overdrive/git-coord");
  const { mark } = await import("../src/lib/overdrive/board");
  const { sendImessage } = await import("../src/lib/overdrive/notify");
  const id = Number(idStr);
  await withBoard((rows) => mark(rows, id, "CLAIMED", { machine: name, lease: "", log: `handed to ${name}` }));
  await sendImessage(`📋 #${id} handed to ${name}`, process.env.OVERDRIVE_RELAY ?? "http://100.77.126.8:8787");
  console.log(`assigned #${id} → ${name}`);
}

if (process.argv[2] === "assign") assign();
else main();
```

- [ ] **Step 2: Create the bash wrapper**

Create `scripts/overdrive`:
```bash
#!/usr/bin/env bash
# Operation Overdrive — Watchtower. Usage: overdrive  |  overdrive assign <id> <name>
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx tsx scripts/overdrive.ts "$@"
```
Run: `chmod +x scripts/overdrive`

- [ ] **Step 3: Manual verification**

Run:
```bash
cd ~/Projects/TMMT
./scripts/catch "test watchtower row"
./scripts/overdrive
./scripts/overdrive assign 1 Dominique
```
Expected: the Watchtower prints the roster + jobs; `assign` marks the row handed to Dominique and sends an iMessage.

- [ ] **Step 4: Clear + commit**
```bash
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(m => m.withBoard(() => []))"
git add scripts/overdrive.ts scripts/overdrive
git commit -m "feat(overdrive): Watchtower view + manual hand-off to a person"
```

---

## Task 12: Always-on (LaunchAgent) + `tmmt` verbs

**Files:**
- Create: `scripts/overdrive/com.tmmt.router.plist`
- Modify: `scripts/tmmt` (add `catch`, `overdrive`, `router` verbs)

- [ ] **Step 1: Create the LaunchAgent template**

Create `scripts/overdrive/com.tmmt.router.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tmmt.router</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd "$HOME/Projects/TMMT" &amp;&amp; exec ./scripts/router up</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/tmmt-router.log</string>
  <key>StandardErrorPath</key><string>/tmp/tmmt-router.err</string>
</dict>
</plist>
```

- [ ] **Step 2: Add `router install`/`uninstall` to the daemon wrapper**

Append to `scripts/router` (before the final `exec` line), replacing the file body with:
```bash
#!/usr/bin/env bash
# Operation Overdrive — worker daemon. Usage: router [up|once|install|uninstall|status]
set -euo pipefail
cd "$(dirname "$0")/.."
PLIST="$HOME/Library/LaunchAgents/com.tmmt.router.plist"
case "${1:-up}" in
  install)
    cp scripts/overdrive/com.tmmt.router.plist "$PLIST"
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "router: installed + loaded (always-on). Logs: /tmp/tmmt-router.log" ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"; echo "router: uninstalled" ;;
  status)
    launchctl list | grep com.tmmt.router || echo "router: not loaded" ;;
  *)
    exec npx tsx scripts/router.ts "${1:-up}" ;;
esac
```

- [ ] **Step 3: Wire one-word verbs into `scripts/tmmt`**

In `scripts/tmmt`, add cases that delegate to the new scripts (match the file's existing `case` style):
```bash
  catch)      shift; exec "$ROOT/scripts/catch" "$@" ;;
  watch|overdrive) shift; exec "$ROOT/scripts/overdrive" "$@" ;;
  router)     shift; exec "$ROOT/scripts/router" "$@" ;;
```
(If `scripts/tmmt` uses a variable other than `$ROOT` for the repo root, use that variable. Verify by reading the top of `scripts/tmmt` first.)

- [ ] **Step 4: Manual verification**
```bash
cd ~/Projects/TMMT
./scripts/tmmt catch "verb wiring works"
./scripts/tmmt watch
./scripts/router install && ./scripts/router status
sleep 25 && tail -5 /tmp/tmmt-router.log
./scripts/router uninstall
```
Expected: `catch` queues via the `tmmt` verb; `watch` shows the board; install loads the agent, log shows `router: up`, status lists it; uninstall removes it.

- [ ] **Step 5: Clear + commit**
```bash
npx tsx -e "import('./scripts/overdrive/git-coord.ts').then(m => m.withBoard(() => []))"
git add scripts/overdrive/com.tmmt.router.plist scripts/router scripts/tmmt
git commit -m "feat(overdrive): LaunchAgent always-on + tmmt catch/watch/router verbs"
```

---

## Task 13: Runbook + full test gate

**Files:**
- Create: `docs/OPERATION-OVERDRIVE.md`
- Modify: `CLAUDE.md` (add a short Operation Overdrive section)

- [ ] **Step 1: Write the runbook**

Create `docs/OPERATION-OVERDRIVE.md` covering: the three commands (`catch`, `watch`/`overdrive`, `router`), the cost ladder, the dispatch ladder + manual hand-off, the `overdrive-coord` branch, the `~/.tmmt/ledger.tsv` learning log, safety (`dark` kill-switch, test gate, deploy stays `scripts/ship`), superwhisper setup (file-drop to `~/.tmmt/inbox` OR a Shortcut piping to `scripts/catch`), and which machines run `router` day one (M1 "Rick" + BRAINIAC). Reference this plan + the spec.

- [ ] **Step 2: Add a CLAUDE.md pointer**

Add a section to `CLAUDE.md` summarizing Operation Overdrive in ~4 lines and pointing at `docs/OPERATION-OVERDRIVE.md` + the spec.

- [ ] **Step 3: Run the full gate**

Run:
```bash
cd ~/Projects/TMMT
npm test
npm run build
npm run lint
```
Expected: all green (vitest includes every `src/lib/overdrive/*.test.ts`).

- [ ] **Step 4: Commit**
```bash
git add docs/OPERATION-OVERDRIVE.md CLAUDE.md
git commit -m "docs(overdrive): Phase 1 runbook + CLAUDE.md pointer"
```

---

## Self-Review

**Spec coverage:**
- §4 capture → Tasks 2 (parser) + 9 (`catch`, superwhisper/paste/stdin). ✓
- §5 router loop (kill-switch, presence, capacity, claim, dispatch, gate, settle) → Task 10. (Capacity = 1 task/tick in Phase 1; multi-concurrency is a documented Phase-2 lever.) ✓
- §6 cost ladder → Task 3 + executor Task 7. ✓
- §6.5 Watchtower + manual hand-off → Task 11. ✓
- §7 board schema + stale reclaim → Tasks 1 + 4 + 8. ✓
- §8 ledger → Task 6. ✓
- §9 safety (gate, seal, dark, dry-run) → Tasks 10/12 (router never runs `scripts/ship`; `dark` parks; `ROUTER_DRYRUN`). ✓
- §10 error handling (Ollama down, lease reclaim, offline capture, relay unreachable) → Tasks 2/4/5/8. ✓
- §11 testing → unit Tasks 1–7, integration dry-run Task 10. ✓

**Placeholder scan:** no TBD/"handle errors"/uncoded steps; every code step has full code. ✓
**Type consistency:** `BoardRow`, `CapturedTask`, `LedgerEntry`, `Tier`, `tierForHint`, `pickStartTier`, `escalate`, `withBoard`, `readBoard`, `runTier`, `buildTierCommand`, `formatNotification`, `sendImessage` used identically across tasks. ✓

**Known follow-ups (Phase 2+, intentionally out of scope):** multi-task concurrency per machine, automated human escalation/SLAs, broadened auto-capture, real learning, cross-device skill/file federation.
