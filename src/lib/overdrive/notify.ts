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
