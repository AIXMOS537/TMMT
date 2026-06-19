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
