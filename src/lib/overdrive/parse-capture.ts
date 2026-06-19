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
